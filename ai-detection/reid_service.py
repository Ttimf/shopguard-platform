"""
ReID Service — единый сервис Person Re-Identification для всех AI Worker.

Держит ОБЩУЮ галерею эмбеддингов (единственный экземпляр существующего
ReIDManager) и отвечает на RPC `reid.identify` (Redis pub/sub, тот же транспорт,
что и у остального проекта). Логика ReID — только здесь; AI Worker'ы галерею не
хранят, а шлют эмбеддинги сюда. Любое число воркеров обращается к одному сервису
→ общая галерея и межкамерное объединение треков между воркерами.

Запуск: тот же образ ai-detection, но команда `python reid_service.py`.
"""
import time

import numpy as np

from app import settings
from app.reid_manager import ReIDManager
from app.redis_rpc_server import RedisRpcServer


def main():
    manager = ReIDManager()  # ЕДИНСТВЕННАЯ общая галерея

    def identify(data: dict) -> dict:
        emb = data.get("embedding")
        embedding = (
            np.array(emb, dtype=np.float32) if isinstance(emb, list) and emb else None
        )
        gid, sim, matched = manager.identify(
            embedding,
            str(data.get("cameraId", "")),
            str(data.get("localTrackId", "")),
            float(data.get("confidence", 0.0)),
            time.time(),  # серверное время — для last_seen/TTL
        )
        return {"globalPersonId": gid, "similarity": sim, "matched": matched}

    server = RedisRpcServer(
        settings.REDIS_HOST,
        settings.REDIS_PORT,
        settings.REDIS_PASSWORD,
        {settings.REID_RPC_PATTERN: identify},
    )
    print(
        f"reid-service: запущен (порог={settings.REID_SIMILARITY_THRESHOLD}, "
        f"TTL={settings.REID_EMBEDDING_LIFETIME_SECONDS}с, "
        f"maxEmb={settings.REID_MAX_EMBEDDINGS})"
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
