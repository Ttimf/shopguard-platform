"""
ai-detection — сервис видеоаналитики (Python + YOLO).

Оркестрация (Этап 7a):
  - health-check на /api/health;
  - периодический опрос конфигурации камер у camera-service (Redis RPC);
  - на каждую активную камеру — воркер: RTSP → YOLO-трекинг → зоны → логика кражи;
  - события публикуются в Redis Stream 'detection.events' (снимок+клип в MinIO).

Границы: сервис НЕ шлёт Telegram/push и НЕ пишет в БД — только публикует события.
"""
import base64
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import cv2
import numpy as np

from app import settings
from app import rtsp_probe
from app.camera_worker import CameraWorker
from app.config_client import ConfigClient
from app.event_bus import EventBus
from app.event_publisher import EventPublisher
from app.face_recognizer import FaceRecognizer
from app.faces import FaceIndex
from app.frame_registry import FrameRegistry
from app.model_manager import ModelManager
from app.redis_rpc import RedisRpc
from app.storage import Storage
from app.worker_client import WorkerClient


class ApiHandler(BaseHTTPRequestHandler):
    """health + управление моделью + RTSP-тест/снапшот (внутренний)."""

    manager: ModelManager | None = None  # ставится в main()
    frames: FrameRegistry | None = None  # реестр последних кадров

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.rstrip("/")
        if path == "/api/health":
            self._json(200, {"service": "ai-detection", "status": "ok"})
        elif path == "/ai/model":
            info = self.manager.current_info() if self.manager else None
            if info is None:
                self._json(503, {"error": "модель не загружена"})
            else:
                self._json(200, info.to_api())
        elif path == "/internal/models":
            if self.manager is None:
                self._json(503, {"error": "менеджер моделей не готов"})
            else:
                self._json(200, {
                    "available": self.manager.available_names(),
                    "default": self.manager.default_name(),
                })
        else:
            self._json(404, {"error": "not found"})

    def _body(self) -> dict | None:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw or b"{}")
        except json.JSONDecodeError:
            return None

    def do_POST(self):
        path = self.path.rstrip("/")
        if path == "/ai/model/switch":
            return self._switch_model()
        if path == "/internal/camera/test":
            return self._camera_test()
        if path == "/internal/camera/snapshot":
            return self._camera_snapshot()
        return self._json(404, {"error": "not found"})

    def _switch_model(self):
        if self.manager is None:
            return self._json(503, {"error": "менеджер моделей не готов"})
        data = self._body()
        if data is None:
            return self._json(400, {"error": "некорректный JSON"})
        model = (data or {}).get("model")
        if not model:
            return self._json(400, {"error": "нужно поле 'model'"})
        try:
            info = self.manager.switch(model)
        except FileNotFoundError as e:
            return self._json(404, {"error": str(e)})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": str(e)})
        self._json(200, info.to_api())

    def _camera_test(self):
        data = self._body()
        if data is None or not data.get("rtspUrl"):
            return self._json(400, {"error": "нужно поле 'rtspUrl'"})
        result = rtsp_probe.test_stream(data["rtspUrl"])
        # авто-определение вендора (best-effort, не влияет на online)
        info = rtsp_probe.detect_camera_info(data["rtspUrl"])
        result["manufacturer"] = info["manufacturer"]
        result["model"] = info["model"]
        self._json(200, result)

    def _camera_snapshot(self):
        data = self._body()
        if data is None or not data.get("rtspUrl"):
            return self._json(400, {"error": "нужно поле 'rtspUrl'"})
        camera_id = data.get("cameraId")
        jpeg = None
        # сначала — свежий кадр активного воркера (без 2-го подключения)
        if camera_id and self.frames:
            frame = self.frames.get(camera_id)
            if frame is not None:
                jpeg = rtsp_probe.encode_jpeg(frame)
                print(f"[snapshot] {camera_id}: кадр из активного воркера")
        if jpeg is None:
            print(f"[snapshot] {camera_id}: разовое подключение к RTSP")
            jpeg = rtsp_probe.grab_frame(data["rtspUrl"])
        if jpeg is None:
            return self._json(200, {"online": False, "error": "RTSP stream unavailable"})
        self._json(200, {"online": True, "image": base64.b64encode(jpeg).decode()})

    def log_message(self, *args):
        pass


def start_api_server():
    HTTPServer(("0.0.0.0", settings.HTTP_PORT), ApiHandler).serve_forever()


def _signature(cfg: dict) -> str:
    """Сигнатура конфига камеры — чтобы перезапускать воркер при изменениях."""
    return json.dumps(
        {
            "rtsp": cfg.get("rtspUrl"),
            "fps": cfg.get("fpsLimit"),
            "zones": cfg.get("zones"),
            "behavior": cfg.get("behavior"),
            "model": cfg.get("modelOverride"),  # смена модели магазина рестартит воркер
        },
        sort_keys=True,
    )


class Orchestrator:
    def __init__(
        self,
        config_client: ConfigClient,
        publisher: EventPublisher,
        storage: Storage,
        face_recognizer: FaceRecognizer,
        model_manager: ModelManager,
        frame_registry: FrameRegistry,
        event_bus: EventBus,
    ):
        self._config_client = config_client
        self._publisher = publisher
        self._storage = storage
        self._faces = face_recognizer
        self._models = model_manager
        self._frames = frame_registry
        self._events = event_bus
        self._workers: dict[str, tuple[CameraWorker, str]] = {}
        self._embed_cache: dict[str, np.ndarray] = {}  # photoKey -> embedding

    def sync(self) -> None:
        try:
            configs = self._config_client.fetch()
        except Exception as e:  # noqa: BLE001
            print(f"[orchestrator] не удалось получить конфиг: {e}")
            return

        wanted = {c["id"]: c for c in configs}

        # остановить удалённые/изменённые + убрать «мёртвые» (упавший поток),
        # чтобы они пересоздались ниже — камера не теряется навсегда
        for cam_id in list(self._workers):
            worker, sig = self._workers[cam_id]
            stale = cam_id not in wanted or _signature(wanted[cam_id]) != sig
            dead = not worker.is_alive()
            if stale or dead:
                worker.stop()
                del self._workers[cam_id]
                if dead and not stale:
                    print(f"[orchestrator] воркер {cam_id} умер — будет перезапущен")

        # запустить новые/изменённые
        for cam_id, cfg in wanted.items():
            if cam_id in self._workers:
                continue
            worker = CameraWorker(
                cfg, self._publisher, self._models, self._frames,
                self._events, self._faces,
            )
            worker.start()
            self._workers[cam_id] = (worker, _signature(cfg))
            print(f"[orchestrator] запущена камера {cam_id} ({cfg.get('name')})")

        self._sync_blacklist()

    def _sync_blacklist(self) -> None:
        """Обновляет индексы лиц по магазинам и раздаёт их воркерам."""
        if not self._faces.ready:
            return
        try:
            entries = self._config_client.fetch_blacklist()
        except Exception as e:  # noqa: BLE001
            print(f"[orchestrator] не удалось получить чёрный список: {e}")
            return

        indexes: dict[str, FaceIndex] = {}
        for entry in entries:
            emb = self._embedding(entry["photoKey"])
            if emb is None:
                continue
            idx = indexes.setdefault(
                entry["storeId"], FaceIndex(threshold=settings.FACE_THRESHOLD)
            )
            idx.add(entry["name"], emb)

        empty = FaceIndex(threshold=settings.FACE_THRESHOLD)
        for worker, _sig in self._workers.values():
            worker.face_index = indexes.get(worker.store_id, empty)

    def _embedding(self, photo_key: str):
        cached = self._embed_cache.get(photo_key)
        if cached is not None:
            return cached
        try:
            data = self._storage.get(photo_key)
            img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            emb = self._faces.embed_photo(img)
        except Exception as e:  # noqa: BLE001
            print(f"[orchestrator] не удалось обработать фото {photo_key}: {e}")
            return None
        if emb is not None:
            self._embed_cache[photo_key] = emb
        return emb


def _build_storage() -> Storage:
    """Ждём доступности MinIO (bucket) перед запуском воркеров."""
    while True:
        try:
            return Storage()
        except Exception as e:  # noqa: BLE001
            print(f"[main] хранилище недоступно, повтор через 5с: {e}")
            time.sleep(5)


def main():
    # 1) модель — до старта сервера, чтобы /ai/model был готов сразу
    model_manager = ModelManager(settings.MODELS_DIR, settings.YOLO_MODEL)
    model_manager.load()  # печатает информацию о модели
    frame_registry = FrameRegistry()
    ApiHandler.manager = model_manager
    ApiHandler.frames = frame_registry

    threading.Thread(target=start_api_server, daemon=True).start()
    print(f"ai-detection: API/health на :{settings.HTTP_PORT}")

    rpc = RedisRpc(settings.REDIS_HOST, settings.REDIS_PORT, settings.REDIS_PASSWORD)
    storage = _build_storage()
    publisher = EventPublisher(storage)

    faces = FaceRecognizer()
    if faces.load():
        print("ai-detection: распознавание лиц включено")
    else:
        print("ai-detection: работаем без распознавания лиц")

    event_bus = EventBus()
    orchestrator = Orchestrator(
        ConfigClient(rpc), publisher, storage, faces, model_manager,
        frame_registry, event_bus,
    )

    # AI Worker: регистрация узла + heartbeat каждые ~5с
    # (метрики GPU/CPU/RAM берёт WorkerClient, а камеры/треки/FPS — отсюда).
    hb_state = {"frames": 0, "time": time.time()}

    def _worker_metrics():
        workers = [w for (w, _sig) in orchestrator._workers.values()]
        cameras = len(workers)
        tracks = sum(w.active_tracks for w in workers)
        total_frames = sum(w.frames_processed for w in workers)
        now = time.time()
        dt = now - hb_state["time"]
        fps = int((total_frames - hb_state["frames"]) / dt) if dt > 0 else 0
        hb_state["frames"] = total_frames
        hb_state["time"] = now
        return cameras, tracks, max(0, fps)

    worker = WorkerClient(
        RedisRpc(settings.REDIS_HOST, settings.REDIS_PORT, settings.REDIS_PASSWORD),
        _worker_metrics,
    )
    worker.register()
    worker.start_heartbeat()

    print("ai-detection: запущен, опрос конфигурации камер…")
    while True:
        orchestrator.sync()
        time.sleep(settings.CONFIG_REFRESH_SECONDS)


if __name__ == "__main__":
    main()
