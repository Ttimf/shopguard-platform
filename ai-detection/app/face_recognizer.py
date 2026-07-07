"""
Обёртка над InsightFace (перенос из ../shopguard/src/detection/face_recognizer.py).

Одна модель на процесс (get() без состояния — можно делить между камерами).
Даёт эмбеддинги лиц из кадра и из фото чёрного списка.
Если InsightFace недоступен — сервис продолжает работать без распознавания лиц.
"""
import numpy as np


class FaceRecognizer:
    def __init__(self, det_size: int = 640):
        self._det_size = det_size
        self._app = None

    def load(self) -> bool:
        try:
            from insightface.app import FaceAnalysis

            self._app = FaceAnalysis(
                name="buffalo_sc",
                providers=["CPUExecutionProvider"],
            )
            self._app.prepare(ctx_id=0, det_size=(self._det_size, self._det_size))
            return True
        except Exception as e:  # noqa: BLE001
            print(f"[faces] InsightFace недоступен: {e}")
            self._app = None
            return False

    @property
    def ready(self) -> bool:
        return self._app is not None

    def embed_photo(self, image_bgr: np.ndarray) -> np.ndarray | None:
        """Эмбеддинг первого лица на фото (для чёрного списка)."""
        faces = self._detect(image_bgr)
        return faces[0][1] if faces else None

    def detect(self, frame_bgr: np.ndarray) -> list[tuple[list[int], np.ndarray]]:
        """Список (bbox, embedding) для всех лиц в кадре."""
        return self._detect(frame_bgr)

    def _detect(self, image) -> list[tuple[list[int], np.ndarray]]:
        if self._app is None:
            return []
        out = []
        for face in self._app.get(image):
            if face.embedding is None:
                continue
            x1, y1, x2, y2 = face.bbox.astype(int).tolist()
            out.append(([x1, y1, x2, y2], face.embedding))
        return out
