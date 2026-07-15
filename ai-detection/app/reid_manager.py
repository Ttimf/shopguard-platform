"""
ReIDManager — межкамерная идентификация людей поверх локального трекинга.

Отвечает ТОЛЬКО за ReID (не за ByteTrack): хранит эмбеддинги, считает cosine
similarity, ищет совпадения, сопоставляет нового человека с существующими,
объединяет локальные треки в один global_person_id, чистит устаревшие эмбеддинги
и ведёт жизненный цикл глобальных идентификаторов.

Один экземпляр на процесс — общий для всех камер (потокобезопасен через lock),
что и обеспечивает объединение треков МЕЖДУ камерами.
"""
import threading
import uuid

import numpy as np

from . import settings


class PersonRecord:
    """Глобальная личность: галерея эмбеддингов + метаданные последнего трека."""

    __slots__ = (
        "global_person_id",
        "embeddings",
        "camera_id",
        "local_track_id",
        "first_seen",
        "last_seen",
        "confidence",
    )

    def __init__(self, gid, embedding, camera_id, local_track_id, now, confidence):
        self.global_person_id = gid
        self.embeddings = [embedding] if embedding is not None else []
        self.camera_id = camera_id
        self.local_track_id = local_track_id
        self.first_seen = now
        self.last_seen = now
        self.confidence = confidence


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0.0 or nb == 0.0:
        return -1.0
    return float(np.dot(a, b) / (na * nb))


class ReIDManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._people: dict[str, PersonRecord] = {}
        # (camera_id, local_track_id) -> global_person_id — стабильный gid для трека,
        # в т.ч. как fallback, когда эмбеддинг недоступен (ReID выключен).
        self._track_map: dict[tuple, str] = {}

    def identify(
        self, embedding, camera_id: str, local_track_id: str, confidence: float, now: float
    ) -> tuple[str, float, bool]:
        """
        Возвращает (global_person_id, similarity, matched).
        Объединяет локальный трек с существующей личностью, если cosine >= порога;
        иначе заводит нового человека.
        """
        with self._lock:
            self._cleanup(now)
            key = (camera_id, local_track_id)

            if embedding is None:
                gid = self._track_map.get(key)
                if gid is None:
                    gid = uuid.uuid4().hex
                    self._track_map[key] = gid
                return gid, 0.0, False

            best_gid, best_sim = None, -1.0
            for gid, person in self._people.items():
                sim = self._gallery_similarity(embedding, person.embeddings)
                if sim > best_sim:
                    best_sim, best_gid = sim, gid

            if best_gid is not None and best_sim >= settings.REID_SIMILARITY_THRESHOLD:
                person = self._people[best_gid]
                self._append_embedding(person, embedding)
                person.camera_id = camera_id
                person.local_track_id = local_track_id
                person.last_seen = now
                person.confidence = confidence
                self._track_map[key] = best_gid
                return best_gid, float(best_sim), True

            gid = uuid.uuid4().hex
            self._people[gid] = PersonRecord(
                gid, embedding, camera_id, local_track_id, now, confidence
            )
            self._track_map[key] = gid
            return gid, float(max(best_sim, 0.0)), False

    def _gallery_similarity(self, embedding, gallery) -> float:
        if not gallery:
            return -1.0
        return max(_cosine(embedding, g) for g in gallery)

    def _append_embedding(self, person: PersonRecord, embedding) -> None:
        person.embeddings.append(embedding)
        # ограничение галереи (Max Embeddings) — FIFO
        while len(person.embeddings) > settings.REID_MAX_EMBEDDINGS:
            person.embeddings.pop(0)

    def _cleanup(self, now: float) -> None:
        """Удаляет личности, не появлявшиеся дольше Embedding Lifetime."""
        ttl = settings.REID_EMBEDDING_LIFETIME_SECONDS
        stale = [gid for gid, p in self._people.items() if now - p.last_seen > ttl]
        if not stale:
            return
        stale_set = set(stale)
        for gid in stale:
            del self._people[gid]
        for k in [k for k, v in self._track_map.items() if v in stale_set]:
            del self._track_map[k]

    def stats(self) -> dict:
        with self._lock:
            return {
                "people": len(self._people),
                "tracks": len(self._track_map),
                "embeddings": sum(len(p.embeddings) for p in self._people.values()),
            }
