import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.zones import ZoneMap, point_in_polygon  # noqa: E402
from app.theft_logic import Behavior, TheftDetector  # noqa: E402

SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]]


def test_point_in_polygon():
    assert point_in_polygon(5, 5, SQUARE)
    assert not point_in_polygon(15, 5, SQUARE)
    assert not point_in_polygon(-1, -1, SQUARE)


def test_zonemap_center():
    zones = [
        {"type": "SHELF", "polygon": [[0, 0], [100, 0], [100, 100], [0, 100]]},
        {"type": "EXIT", "polygon": [[200, 0], [300, 0], [300, 100], [200, 100]]},
    ]
    zm = ZoneMap(zones)
    assert zm.in_shelf([40, 40, 60, 60])  # центр (50,50)
    assert not zm.in_exit([40, 40, 60, 60])
    assert zm.in_exit([240, 40, 260, 60])  # центр (250,50)


def _behavior():
    return Behavior(
        shelf_dwell_seconds=3.0,
        exit_confirm_seconds=5.0,
        max_person_lost_seconds=10.0,
    )


def test_theft_full_sequence():
    det = TheftDetector(_behavior(), cooldown_seconds=30)
    t = 1000.0
    # у полки < dwell — ещё не "взял"
    assert not det.update(1, in_shelf=True, in_exit=False, now=t).theft
    assert not det.update(1, in_shelf=True, in_exit=False, now=t + 2).theft
    # прошёл порог dwell (>=3с) — товар "взят"
    took = det.update(1, in_shelf=True, in_exit=False, now=t + 3.1)
    assert took.took_product and not took.theft
    # у выхода < confirm
    assert not det.update(1, in_shelf=False, in_exit=True, now=t + 4).theft
    # у выхода >= confirm (5с) → кража
    assert det.update(1, in_shelf=False, in_exit=True, now=t + 9.2).theft
    # повторно не срабатывает (alerted)
    assert not det.update(1, in_shelf=False, in_exit=True, now=t + 10).theft


def test_no_theft_without_shelf_first():
    det = TheftDetector(_behavior(), cooldown_seconds=30)
    t = 2000.0
    # сразу у выхода, без полки — не кража
    assert not det.update(7, in_shelf=False, in_exit=True, now=t).theft
    assert not det.update(7, in_shelf=False, in_exit=True, now=t + 20).theft


def test_leaving_shelf_early_resets():
    det = TheftDetector(_behavior(), cooldown_seconds=30)
    t = 3000.0
    det.update(2, in_shelf=True, in_exit=False, now=t)      # вошёл
    det.update(2, in_shelf=False, in_exit=False, now=t + 1)  # ушёл рано (<3с)
    # к выходу — не должен считаться "взявшим товар"
    assert not det.update(2, in_shelf=False, in_exit=True, now=t + 10).theft


def test_entered_exit_signal():
    det = TheftDetector(_behavior(), cooldown_seconds=30)
    t = 100.0
    assert det.update(5, False, True, t).entered_exit  # переход в выход
    assert not det.update(5, False, True, t + 1).entered_exit  # уже внутри


def test_cooldown_blocks_second_track():
    det = TheftDetector(_behavior(), cooldown_seconds=30)
    t = 4000.0
    # трек 1 — кража (полка >=3с, затем выход >=5с)
    det.update(1, True, False, t)
    det.update(1, True, False, t + 3.1)
    det.update(1, False, True, t + 4)
    assert det.update(1, False, True, t + 9.2).theft
    # трек 2 крадёт в пределах кулдауна (30с) — подавлено
    det.update(2, True, False, t + 9)
    det.update(2, True, False, t + 12.2)
    det.update(2, False, True, t + 13)
    assert not det.update(2, False, True, t + 18.5).theft


def test_prune_lost_tracks():
    det = TheftDetector(_behavior(), cooldown_seconds=30)
    t = 5000.0
    det.update(1, True, False, t)
    det.prune(now=t + 11)  # > max_person_lost (10)
    assert 1 not in det._tracks


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
