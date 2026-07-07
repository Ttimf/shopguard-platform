import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np  # noqa: E402

from app.faces import FaceIndex, cosine_similarity  # noqa: E402


def test_cosine_similarity():
    a = np.array([1.0, 0.0, 0.0])
    assert cosine_similarity(a, a) == 1.0
    assert cosine_similarity(a, np.array([0.0, 1.0, 0.0])) == 0.0
    assert cosine_similarity(a, np.zeros(3)) == 0.0  # деление на ноль


def test_index_match_above_threshold():
    idx = FaceIndex(threshold=0.9)
    idx.add("Иван", np.array([1.0, 0.0, 0.0]))
    idx.add("Пётр", np.array([0.0, 1.0, 0.0]))
    # почти как Иван
    hit = idx.match(np.array([0.98, 0.02, 0.0]))
    assert hit is not None
    assert hit[0] == "Иван"
    assert hit[1] >= 0.9


def test_index_no_match_below_threshold():
    idx = FaceIndex(threshold=0.9)
    idx.add("Иван", np.array([1.0, 0.0, 0.0]))
    # ортогональный вектор — не совпадёт
    assert idx.match(np.array([0.0, 1.0, 0.0])) is None


def test_index_picks_best_of_many():
    idx = FaceIndex(threshold=0.5)
    idx.add("A", np.array([1.0, 0.0]))
    idx.add("B", np.array([0.7, 0.7]))
    hit = idx.match(np.array([0.6, 0.8]))  # ближе к B
    assert hit is not None
    assert hit[0] == "B"


def test_empty_index():
    idx = FaceIndex()
    assert len(idx) == 0
    assert idx.match(np.array([1.0, 0.0])) is None


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
