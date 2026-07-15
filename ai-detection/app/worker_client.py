"""
AI Worker: регистрация узла ai-detection и heartbeat в WorkerManager.

Транспорт — существующий RedisRpc (request/reply), тот же, что для конфига камер
(не вводим новый механизм). worker_id — UUID, генерируется при старте.
Метрики камер/треков/FPS отдаёт вызывающий код через metrics_provider.
"""
import datetime
import socket
import threading
import uuid

try:
    import psutil
except Exception:  # noqa: BLE001 — psutil может отсутствовать
    psutil = None

from . import settings
from .gpu_metrics import GpuMetrics
from .redis_rpc import RedisRpc


class WorkerClient:
    def __init__(self, rpc: RedisRpc, metrics_provider, worker_id: str | None = None):
        """
        rpc — отдельный RedisRpc (своё соединение, чтобы не конфликтовать с
        опросом конфига из основного потока).
        metrics_provider — callable() -> (cameras: int, tracks: int, fps: int).
        worker_id — общий id воркера (для регистрации и шардинга); если не задан,
        генерируется здесь.
        """
        self._rpc = rpc
        self._metrics = metrics_provider
        self._gpu = GpuMetrics()
        self.worker_id = worker_id or str(uuid.uuid4())
        self.hostname = socket.gethostname()
        self.started_at = datetime.datetime.now(datetime.timezone.utc)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def register(self) -> None:
        payload = {
            "workerId": self.worker_id,
            "hostname": self.hostname,
            "version": settings.WORKER_VERSION,
            "startedAt": self.started_at.isoformat(),
            **self._gpu.static_info(),
        }
        try:
            self._rpc.request(settings.WORKER_REGISTER_PATTERN, payload, timeout=10.0)
            print(f"[worker] зарегистрирован {self.worker_id} "
                  f"({self.hostname}, GPU={payload.get('gpuName')})")
        except Exception as e:  # noqa: BLE001 — регистрация не должна ронять сервис
            print(f"[worker] регистрация не удалась: {e}")

    def start_heartbeat(self) -> None:
        self._thread = threading.Thread(
            target=self._loop, daemon=True, name="worker-heartbeat")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._send()
            if self._stop.wait(settings.WORKER_HEARTBEAT_SECONDS):
                break

    def _send(self) -> None:
        cpu = ram = None
        if psutil is not None:
            try:
                cpu = int(psutil.cpu_percent())
            except Exception:  # noqa: BLE001
                pass
            try:
                ram = int(psutil.virtual_memory().percent)
            except Exception:  # noqa: BLE001
                pass
        cameras, tracks, fps = self._metrics()
        payload = {
            "workerId": self.worker_id,
            "status": "ONLINE",
            **self._gpu.live(),
            "cpu": cpu,
            "ram": ram,
            "fps": fps,
            "cameras": cameras,
            "tracks": tracks,
        }
        try:
            self._rpc.request(settings.WORKER_HEARTBEAT_PATTERN, payload, timeout=5.0)
        except Exception as e:  # noqa: BLE001 — heartbeat не должен ронять детекцию
            print(f"[worker] heartbeat не отправлен: {e}")
