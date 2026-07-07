"""Публикация обобщённых событий в шину Event Engine (Redis Stream events.stream)."""
import datetime
import json
import uuid

import redis

from . import settings


class EventBus:
    def __init__(self):
        self._redis = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            protocol=2,
        )

    def publish(
        self,
        event_type: str,
        store_id: str,
        camera_id: str | None = None,
        tracking_id: int | None = None,
        confidence: float | None = None,
        model_version: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        event = {
            "eventId": uuid.uuid4().hex,
            "storeId": store_id,
            "cameraId": camera_id,
            "trackingId": tracking_id,
            "eventType": event_type,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "confidence": confidence,
            "modelVersion": model_version,
            "metadata": metadata,
        }
        try:
            self._redis.xadd(settings.EVENTS_STREAM, {"data": json.dumps(event)})
        except Exception as e:  # noqa: BLE001 — шина не должна ронять детекцию
            print(f"[event-bus] не удалось опубликовать {event_type}: {e}")
