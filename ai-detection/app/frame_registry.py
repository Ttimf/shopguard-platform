"""Потокобезопасный реестр последних кадров камер (для снапшота без 2-го подключения)."""
import threading
import time


class FrameRegistry:
    def __init__(self):
        self._lock = threading.Lock()
        self._frames: dict[str, tuple] = {}  # cameraId -> (frame, ts)

    def put(self, camera_id: str, frame) -> None:
        with self._lock:
            self._frames[camera_id] = (frame, time.time())

    def get(self, camera_id: str, max_age: float = 5.0):
        """Свежий кадр камеры или None, если его нет/устарел."""
        with self._lock:
            item = self._frames.get(camera_id)
        if not item:
            return None
        frame, ts = item
        return frame if (time.time() - ts) <= max_age else None

    def drop(self, camera_id: str) -> None:
        with self._lock:
            self._frames.pop(camera_id, None)
