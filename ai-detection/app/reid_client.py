"""
ReIDClient — клиент AI Worker к ReID Service (через существующий Redis RPC).

AI Worker больше НЕ хранит галерею: считает эмбеддинг (ReIDExtractor) и отправляет
его в ReID Service, получая (global_person_id, similarity, matched). Если сервис
недоступен — graceful fallback на стабильный локальный id по треку (matched=False),
чтобы события всё равно получали идентификатор.
"""
import numpy as np

from . import settings
from .redis_rpc import RedisRpc


class ReIDClient:
    def __init__(self, rpc: RedisRpc):
        self._rpc = rpc

    def identify(
        self, embedding, camera_id: str, local_track_id: str, confidence: float
    ) -> tuple[str, float, bool]:
        payload = {
            "embedding": embedding.tolist() if isinstance(embedding, np.ndarray) else None,
            "cameraId": camera_id,
            "localTrackId": local_track_id,
            "confidence": float(confidence),
        }
        try:
            res = self._rpc.request(
                settings.REID_RPC_PATTERN, payload, timeout=settings.REID_RPC_TIMEOUT
            )
            if isinstance(res, dict) and res.get("globalPersonId"):
                return (
                    str(res["globalPersonId"]),
                    float(res.get("similarity", 0.0)),
                    bool(res.get("matched", False)),
                )
        except Exception as e:  # noqa: BLE001 — недоступность ReID Service не роняет детекцию
            print(f"[reid-client] ReID Service недоступен: {e}")
        # fallback: стабильный id по (камера, локальный трек)
        return f"{camera_id}:{local_track_id}", 0.0, False
