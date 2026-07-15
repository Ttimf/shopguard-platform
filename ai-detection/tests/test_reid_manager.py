"""Тесты ReIDManager: cosine-матчинг, объединение треков, TTL, лимит, fallback."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import settings  # noqa: E402
from app.reid_manager import ReIDManager  # noqa: E402


def _v(*x):
    a = np.array(x, dtype=np.float32)
    return a / np.linalg.norm(a)


def _cfg(threshold=0.7, ttl=1000, maxemb=5):
    settings.REID_SIMILARITY_THRESHOLD = threshold
    settings.REID_EMBEDDING_LIFETIME_SECONDS = ttl
    settings.REID_MAX_EMBEDDINGS = maxemb


def test_same_person_matched_same_gid():
    _cfg()
    m = ReIDManager()
    g1, _, matched1 = m.identify(_v(1, 0, 0), "camA", "1", 0.9, 100.0)
    g2, s2, matched2 = m.identify(_v(0.99, 0.02, 0), "camA", "2", 0.9, 101.0)
    assert matched1 is False
    assert matched2 is True and g2 == g1 and s2 >= 0.7


def test_different_person_new_gid():
    _cfg()
    m = ReIDManager()
    g1, _, _ = m.identify(_v(1, 0, 0), "camA", "1", 0.9, 100.0)
    g2, _, matched = m.identify(_v(0, 1, 0), "camA", "2", 0.9, 101.0)
    assert g2 != g1 and matched is False


def test_cross_camera_merge():
    _cfg()
    m = ReIDManager()
    g1, _, _ = m.identify(_v(1, 0, 0), "camA", "1", 0.9, 100.0)
    g2, _, matched = m.identify(_v(0.98, 0.05, 0), "camB", "7", 0.9, 102.0)
    assert matched is True and g2 == g1  # объединение локальных треков разных камер


def test_fallback_no_embedding():
    _cfg()
    m = ReIDManager()
    g1, s, matched = m.identify(None, "camA", "1", 0.9, 100.0)
    g2, _, _ = m.identify(None, "camA", "1", 0.9, 101.0)  # тот же трек → тот же gid
    g3, _, _ = m.identify(None, "camA", "2", 0.9, 101.0)  # другой трек → другой gid
    assert g1 == g2 and g3 != g1 and matched is False and s == 0.0


def test_cleanup_stale():
    _cfg(ttl=10)
    m = ReIDManager()
    g1, _, _ = m.identify(_v(1, 0, 0), "camA", "1", 0.9, 100.0)
    g2, _, matched = m.identify(_v(1, 0, 0), "camA", "2", 0.9, 200.0)  # >TTL → старый вычищен
    assert matched is False and g2 != g1
    assert m.stats()["people"] == 1


def test_max_embeddings_bound():
    _cfg(threshold=0.5, maxemb=3)
    m = ReIDManager()
    for i in range(6):
        m.identify(_v(1, 0.01 * i, 0), "camA", str(i), 0.9, 100.0 + i)
    st = m.stats()
    assert st["people"] == 1 and st["embeddings"] <= 3  # галерея ограничена


if __name__ == "__main__":
    import traceback

    passed = failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
                passed += 1
            except Exception:
                print(f"FAIL {name}")
                traceback.print_exc()
                failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
