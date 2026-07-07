"""Сопоставление эмбеддингов лиц с чёрным списком (чистая логика, numpy)."""
import numpy as np


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


class FaceIndex:
    """Эмбеддинги чёрного списка одного магазина + поиск ближайшего."""

    def __init__(self, threshold: float = 0.45):
        self.threshold = threshold
        self._people: dict[str, np.ndarray] = {}

    def add(self, name: str, embedding: np.ndarray) -> None:
        self._people[name] = np.asarray(embedding, dtype=np.float32)

    def match(self, embedding: np.ndarray) -> tuple[str, float] | None:
        """Возвращает (имя, схожесть) при совпадении выше порога, иначе None."""
        best_name = None
        best_sim = 0.0
        for name, known in self._people.items():
            sim = cosine_similarity(embedding, known)
            if sim > best_sim:
                best_sim = sim
                best_name = name
        if best_name is not None and best_sim >= self.threshold:
            return best_name, best_sim
        return None

    def __len__(self) -> int:
        return len(self._people)
