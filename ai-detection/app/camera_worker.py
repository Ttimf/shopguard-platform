"""
Поток обработки одной камеры: RTSP → YOLO-трекинг → зоны → логика кражи
+ распознавание лиц из чёрного списка магазина.
При событии сохраняет снимок+клип и публикует его.
"""
import threading
import time
from collections import deque

import cv2

from . import ab_router
from . import rtsp_probe
from . import settings
from .event_publisher import EventPublisher
from .face_recognizer import FaceRecognizer
from .faces import FaceIndex
from .model_manager import ModelManager
from .theft_logic import Behavior, TheftDetector
from .zones import ZoneMap


class CameraWorker(threading.Thread):
    def __init__(
        self,
        config: dict,
        publisher: EventPublisher,
        model_manager: ModelManager,
        frame_registry,
        event_bus,
        face_recognizer: FaceRecognizer | None = None,
    ):
        super().__init__(daemon=True, name=f"cam-{config['id']}")
        self._config = config
        self._publisher = publisher
        self._models = model_manager
        self._frames = frame_registry
        self._events = event_bus
        self._seen: set[int] = set()  # треки для PersonDetected
        self._stop = threading.Event()
        self.frames_processed = 0  # для расчёта FPS в heartbeat воркера

        self.camera_id: str = config["id"]
        self.store_id: str = config["storeId"]
        self._rtsp: str = config["rtspUrl"]
        self._fps_limit: int = int(config.get("fpsLimit", 15))
        self._zones = ZoneMap(config.get("zones", []))
        self._theft = TheftDetector(
            Behavior.from_config(config["behavior"]),
            cooldown_seconds=settings.THEFT_COOLDOWN_SECONDS,
        )
        self._buffer: deque = deque(
            maxlen=settings.CLIP_BUFFER_SECONDS * settings.CLIP_FPS
        )

        # распознавание лиц (общая модель, индекс ЧС магазина обновляет оркестратор)
        self._face_recognizer = face_recognizer
        self.face_index = FaceIndex(threshold=settings.FACE_THRESHOLD)
        self._blacklist_last: dict[str, float] = {}
        self._model_version: str | None = None  # для тегирования событий (A/B)

    def stop(self) -> None:
        self._stop.set()

    @property
    def active_tracks(self) -> int:
        """Число текущих отслеживаемых треков (для heartbeat воркера)."""
        return len(self._theft._tracks)

    def run(self) -> None:
        # A/B: эффективная модель магазина (override → canary → default)
        effective = ab_router.resolve_model(
            self.store_id,
            self._config.get("modelOverride"),
            settings.AB_CANARY_MODEL,
            settings.AB_CANARY_PERCENT,
        )
        self._model_version = self._models.version_of(effective)
        following_default = effective is None
        if not following_default:
            print(f"[{self.camera_id}] A/B: модель магазина = {effective}")

        # свой детектор/трекер на камеру (ByteTrack per-instance)
        detector = self._models.create_detector(effective)
        model_gen = self._models.generation
        cap = self._open()
        min_interval = 1.0 / max(1, self._fps_limit)
        last = 0.0
        last_prune = 0.0
        backoff = settings.RECONNECT_MIN_SECONDS
        offline = False

        try:
            while not self._stop.is_set():
                try:
                    ok, frame = cap.read()
                    if not ok:
                        # экспоненциальный backoff (не долбим оффлайн-камеру
                        # бесконечно, но авто-восстанавливаемся при возврате)
                        self._frames.drop(self.camera_id)
                        cap.release()
                        if not offline:
                            offline = True
                            self._emit("CameraOffline")
                        print(f"[{self.camera_id}] поток недоступен, повтор через {backoff}с")
                        if self._stop.wait(backoff):
                            break
                        backoff = min(backoff * 2, settings.RECONNECT_MAX_SECONDS)
                        cap = self._open()
                        continue

                    if offline:
                        offline = False
                        self._emit("CameraOnline")
                    backoff = settings.RECONNECT_MIN_SECONDS  # восстановились — сброс
                    self._frames.put(self.camera_id, frame)

                    now = time.time()
                    if now - last < min_interval:
                        continue
                    last = now
                    self.frames_processed += 1  # для FPS в heartbeat

                    # горячая замена модели при switch() — только если следуем
                    # default (магазины с override/canary закреплены за моделью)
                    if following_default and self._models.generation != model_gen:
                        detector = self._models.create_detector()
                        model_gen = self._models.generation
                        self._model_version = self._models.version_of(None)
                        print(f"[{self.camera_id}] модель обновлена → пересоздан детектор")

                    self._buffer.append(frame.copy())
                    for track in detector.track(frame):
                        if track.track_id not in self._seen:
                            # track_id монотонно растёт → при переполнении можно
                            # очистить (повторного PersonDetected почти не будет)
                            if len(self._seen) >= settings.SEEN_TRACK_CAP:
                                self._seen.clear()
                            self._seen.add(track.track_id)
                            self._emit("PersonDetected", track.track_id, track.confidence)
                        in_shelf = self._zones.in_shelf(track.bbox)
                        in_exit = self._zones.in_exit(track.bbox)
                        sig = self._theft.update(track.track_id, in_shelf, in_exit, now)
                        if sig.took_product:
                            self._emit("ProductTaken", track.track_id)
                        if sig.entered_exit:
                            self._emit("PersonExited", track.track_id)
                        if sig.theft:
                            print(f"[{self.camera_id}] ПОДОЗРЕНИЕ НА КРАЖУ трек #{track.track_id}")
                            self._publisher.publish_theft(
                                camera_id=self.camera_id,
                                track_id=track.track_id,
                                confidence=track.confidence,
                                snapshot=frame,
                                clip_frames=list(self._buffer),
                                model_version=self._model_version,
                            )

                    self._recognize_faces(frame, now)

                    if now - last_prune > 5:
                        self._theft.prune(now)
                        last_prune = now
                except Exception as e:  # noqa: BLE001
                    # устойчивость: сбой обработки кадра не должен ронять поток —
                    # логируем, чуть притормаживаем и продолжаем (при поломке cap
                    # следующий read() уйдёт в ветку переподключения выше)
                    print(f"[{self.camera_id}] ошибка обработки кадра: {e!r}")
                    if self._stop.wait(1):
                        break
        finally:
            cap.release()
            self._frames.drop(self.camera_id)
            print(f"[{self.camera_id}] воркер остановлен")

    def _emit(
        self, event_type: str, tracking_id: int | None = None,
        confidence: float | None = None,
    ) -> None:
        self._events.publish(
            event_type=event_type,
            store_id=self.store_id,
            camera_id=self.camera_id,
            tracking_id=tracking_id,
            confidence=confidence,
            model_version=self._model_version,
        )

    def _recognize_faces(self, frame, now: float) -> None:
        fr = self._face_recognizer
        if fr is None or not fr.ready or len(self.face_index) == 0:
            return
        for _bbox, embedding in fr.detect(frame):
            hit = self.face_index.match(embedding)
            if hit is None:
                continue
            name, sim = hit
            if now - self._blacklist_last.get(name, 0.0) < settings.BLACKLIST_COOLDOWN_SECONDS:
                continue
            self._blacklist_last[name] = now
            print(f"[{self.camera_id}] ЧЁРНЫЙ СПИСОК: {name} ({sim*100:.0f}%)")
            self._publisher.publish_blacklist(
                camera_id=self.camera_id,
                person_name=name,
                similarity=sim,
                snapshot=frame,
                clip_frames=list(self._buffer),
                model_version=self._model_version,
            )

    def _open(self) -> cv2.VideoCapture:
        # общий конструктор с явными таймаутами открытия/чтения
        return rtsp_probe.open_capture(self._rtsp)
