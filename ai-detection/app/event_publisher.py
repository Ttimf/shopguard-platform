"""
Публикация событий детекции в Redis Stream 'detection.events'.

Снимок (и клип, если есть кадры) сохраняются в MinIO, ключи кладутся в событие.
Формат события соответствует контракту DetectionEvent (libs/contracts).
Потребитель — notification-service (Этап 9).
"""
import datetime
import os
import tempfile
import uuid

import cv2
import imageio.v2 as imageio
import redis

from . import settings
from .storage import Storage


class EventPublisher:
    def __init__(self, storage: Storage):
        self._storage = storage
        self._redis = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            protocol=2,
            **settings.REDIS_SSL_KWARGS,  # опциональный TLS (по умолчанию выкл)
        )

    def publish_theft(
        self,
        camera_id: str,
        track_id: int,
        confidence: float,
        snapshot,
        clip_frames: list,
        model_version: str | None = None,
    ) -> None:
        self._publish(
            camera_id,
            snapshot,
            clip_frames,
            {
                "type": "theft",
                "trackId": str(track_id),
                "confidence": f"{confidence:.4f}",
                "modelVersion": model_version or "",
            },
        )

    def publish_blacklist(
        self,
        camera_id: str,
        person_name: str,
        similarity: float,
        snapshot,
        clip_frames: list,
        model_version: str | None = None,
    ) -> None:
        self._publish(
            camera_id,
            snapshot,
            clip_frames,
            {
                "type": "blacklist",
                "personName": person_name,
                "confidence": f"{similarity:.4f}",
                "modelVersion": model_version or "",
            },
        )

    def _publish(
        self, camera_id: str, snapshot, clip_frames: list, extra: dict
    ) -> None:
        ts = datetime.datetime.now(datetime.timezone.utc)
        prefix = f"{camera_id}/{ts.strftime('%Y%m%d')}/{uuid.uuid4().hex}"

        snapshot_key = self._put_snapshot(prefix, snapshot)
        clip_key = self._put_clip(prefix, clip_frames)

        self._redis.xadd(
            settings.DETECTION_EVENTS_STREAM,
            {
                "cameraId": camera_id,
                "snapshotKey": snapshot_key or "",
                "clipKey": clip_key or "",
                "createdAt": ts.isoformat(),
                **extra,
            },
        )

    def _put_snapshot(self, prefix: str, frame) -> str | None:
        ok, buf = cv2.imencode(".jpg", frame)
        if not ok:
            return None
        return self._storage.put(
            f"{prefix}.jpg", buf.tobytes(), "image/jpeg"
        )

    def _put_clip(self, prefix: str, frames: list) -> str | None:
        if len(frames) < 3:
            return None
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        tmp.close()
        try:
            writer = imageio.get_writer(
                tmp.name,
                fps=settings.CLIP_FPS,
                codec="libx264",
                quality=5,
                pixelformat="yuv420p",
            )
            for f in frames:
                writer.append_data(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
            writer.close()
            with open(tmp.name, "rb") as fh:
                data = fh.read()
            return self._storage.put(f"{prefix}.mp4", data, "video/mp4")
        except Exception as e:  # noqa: BLE001
            print(f"[event] не удалось закодировать клип: {e}")
            return None
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass
