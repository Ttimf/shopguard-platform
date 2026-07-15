"""
Извлечение ReID-эмбеддингов человека промышленной моделью OSNet (TorchReID).

Не собственная модель — используется готовый `torchreid.utils.FeatureExtractor`
(OSNet, предобученный). Паттерн как у FaceRecognizer: одна модель на процесс,
graceful-загрузка (если torchreid/веса недоступны — сервис работает без ReID).

ReID НЕ смешивается с ByteTrack: ByteTrack даёт локальные track_id внутри камеры,
здесь — только эмбеддинг кропа человека для межкамерной идентификации.
"""
import numpy as np

from . import settings


class ReIDExtractor:
    def __init__(self):
        self._extractor = None

    def load(self) -> bool:
        if not settings.REID_ENABLED:
            print("[reid] ReID выключен (REID_ENABLED=false)")
            return False
        try:
            from torchreid.utils import FeatureExtractor

            self._extractor = FeatureExtractor(
                model_name=settings.REID_MODEL,
                model_path=settings.REID_MODEL_PATH or "",
                device=settings.REID_DEVICE,
            )
            print(f"[reid] OSNet загружен ({settings.REID_MODEL}, {settings.REID_DEVICE})")
            return True
        except Exception as e:  # noqa: BLE001 — torchreid/веса могут отсутствовать
            print(f"[reid] недоступен, работаем без ReID: {e}")
            self._extractor = None
            return False

    @property
    def ready(self) -> bool:
        return self._extractor is not None

    def embed(self, crop_bgr: np.ndarray) -> np.ndarray | None:
        """L2-нормированный эмбеддинг кропа человека (BGR). None — если не удалось."""
        if self._extractor is None or crop_bgr is None or crop_bgr.size == 0:
            return None
        try:
            import cv2

            rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
            feats = self._extractor([rgb])  # тензор [1, dim]
            vec = feats[0].detach().cpu().numpy().astype(np.float32)
            norm = float(np.linalg.norm(vec))
            return vec / norm if norm > 0 else vec
        except Exception as e:  # noqa: BLE001 — сбой ReID не должен ронять детекцию
            print(f"[reid] ошибка эмбеддинга: {e}")
            return None
