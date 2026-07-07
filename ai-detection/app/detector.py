"""Обёртка над YOLO: детекция + трекинг людей."""
from dataclasses import dataclass

from ultralytics import YOLO

from . import settings

PERSON_CLASS = 0  # COCO: person


@dataclass
class Track:
    track_id: int
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2
    confidence: float


class Detector:
    def __init__(
        self,
        weights_path: str,
        device: str | None = None,
        confidence: float | None = None,
    ):
        self._device = device or settings.YOLO_DEVICE
        self._confidence = (
            confidence if confidence is not None else settings.YOLO_CONFIDENCE
        )
        self._model = YOLO(weights_path)

    def track(self, frame) -> list[Track]:
        """Люди с устойчивыми track_id (ByteTrack внутри ultralytics)."""
        results = self._model.track(
            frame,
            persist=True,
            classes=[PERSON_CLASS],
            conf=self._confidence,
            device=self._device,
            verbose=False,
        )
        boxes = results[0].boxes
        if boxes is None or boxes.id is None:
            return []
        tracks: list[Track] = []
        for bbox, tid, conf in zip(boxes.xyxy, boxes.id, boxes.conf):
            x1, y1, x2, y2 = bbox.tolist()
            tracks.append(
                Track(
                    track_id=int(tid),
                    bbox=(x1, y1, x2, y2),
                    confidence=float(conf),
                )
            )
        return tracks
