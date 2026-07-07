import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ab_router import resolve_model, _bucket  # noqa: E402


def test_override_wins():
    assert resolve_model("s1", "custom.pt", "v2.pt", 100) == "custom.pt"


def test_canary_100_percent_all():
    assert resolve_model("s1", None, "v2.pt", 100) == "v2.pt"


def test_canary_0_percent_none():
    assert resolve_model("s1", None, "v2.pt", 0) is None


def test_default_when_no_canary():
    assert resolve_model("s1", None, None, 10) is None


def test_deterministic():
    a = resolve_model("store-xyz", None, "v2.pt", 50)
    b = resolve_model("store-xyz", None, "v2.pt", 50)
    assert a == b  # один магазин — всегда одна группа


def test_split_roughly_matches_percent():
    # На большой выборке доля canary ≈ проценту (±10пп)
    n = 2000
    canary = sum(
        1 for i in range(n)
        if resolve_model(f"store-{i}", None, "v2.pt", 30) == "v2.pt"
    )
    ratio = canary / n * 100
    assert 20 <= ratio <= 40, f"доля {ratio:.1f}% вне ожидания"


def test_bucket_range():
    for i in range(50):
        assert 0 <= _bucket(f"s{i}") < 100


if __name__ == "__main__":
    import traceback
    passed = failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn(); print(f"PASS {name}"); passed += 1
            except Exception:
                print(f"FAIL {name}"); traceback.print_exc(); failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
