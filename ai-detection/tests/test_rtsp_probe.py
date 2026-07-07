import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.rtsp_probe import detect_camera_info  # noqa: E402
from app.frame_registry import FrameRegistry  # noqa: E402

# .invalid — TLD, который гарантированно не резолвится → HTTP-проба падает быстро,
# остаётся только эвристика по URL (тесты офлайн и детерминированы).


def test_detect_hikvision_by_url():
    info = detect_camera_info("rtsp://cam.invalid:554/Streaming/Channels/101")
    assert info["manufacturer"] == "Hikvision"


def test_detect_dahua_by_url():
    info = detect_camera_info(
        "rtsp://cam.invalid:554/cam/realmonitor?channel=1&subtype=0")
    assert info["manufacturer"] == "Dahua"


def test_detect_axis_by_url():
    info = detect_camera_info("rtsp://cam.invalid/axis-media/media.amp")
    assert info["manufacturer"] == "Axis"


def test_detect_unknown_returns_none():
    info = detect_camera_info("rtsp://cam.invalid:554/stream1")
    assert info["manufacturer"] is None
    assert info["model"] is None


def test_frame_registry_put_get_drop():
    reg = FrameRegistry()
    assert reg.get("c1") is None
    reg.put("c1", "FRAME")
    assert reg.get("c1") == "FRAME"
    reg.drop("c1")
    assert reg.get("c1") is None


def test_frame_registry_expiry():
    reg = FrameRegistry()
    reg.put("c1", "FRAME")
    assert reg.get("c1", max_age=1000) == "FRAME"
    time.sleep(0.03)
    assert reg.get("c1", max_age=0.01) is None  # устарел


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
