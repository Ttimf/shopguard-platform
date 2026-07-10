"""
Тесты устойчивости RTSP-цепочки (интеграционная подготовка):
  - сбой обработки кадра НЕ роняет поток воркера (try/except);
  - cap гарантированно освобождается (try/finally);
  - множество виденных треков ограничено (нет утечки памяти);
  - оркестратор перезапускает «мёртвый» воркер.
Офлайн, без реальной камеры: RTSP-capture и детектор подменены фейками.
"""
import os
import sys
import threading
import time
from dataclasses import dataclass

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import settings  # noqa: E402
from app.camera_worker import CameraWorker  # noqa: E402
from app.frame_registry import FrameRegistry  # noqa: E402
import main as orchestrator_main  # noqa: E402


# ---------- фейки ----------
@dataclass
class FakeTrack:
    track_id: int
    bbox: tuple = (0.0, 0.0, 10.0, 10.0)
    confidence: float = 0.9


class FakeDetector:
    def __init__(self):
        self.calls = 0
        self.raised = False
        self.calls_after_raise = 0

    def track(self, frame):
        self.calls += 1
        if self.calls == 2 and not self.raised:
            self.raised = True
            raise RuntimeError("boom: имитация ошибки декодирования кадра")
        if self.raised:
            self.calls_after_raise += 1
        return [FakeTrack(self.calls)]  # уникальный растущий id → проверка кап _seen


class FakeModels:
    generation = 1

    def __init__(self, detector):
        self._detector = detector

    def version_of(self, _m):
        return "v-test"

    def create_detector(self, _m=None):
        return self._detector


class FakeCap:
    def __init__(self, frame):
        self._frame = frame
        self.released = False

    def read(self):
        return True, self._frame

    def release(self):
        self.released = True

    def set(self, *_a):
        return True


class FakeBus:
    def __init__(self):
        self.events = []

    def publish(self, **kw):
        self.events.append(kw)


class FakePublisher:
    def publish_theft(self, **_kw):
        pass

    def publish_blacklist(self, **_kw):
        pass


# ---------- тест 1: устойчивость воркера + освобождение cap + кап _seen ----------
def test_worker_survives_frame_error_and_releases_cap():
    settings.SEEN_TRACK_CAP = 3  # маленький кап — легко проверить очистку
    frame = np.zeros((8, 8, 3), np.uint8)
    detector = FakeDetector()
    cap = FakeCap(frame)
    bus = FakeBus()

    cfg = {
        "id": "cam-test", "storeId": "s1", "rtspUrl": "rtsp://fake",
        "fpsLimit": 1000,
        "behavior": {"shelfDwellSeconds": 1, "exitConfirmSeconds": 1,
                     "maxPersonLostSeconds": 5},
        "zones": [],
    }
    worker = CameraWorker(
        cfg, FakePublisher(), FakeModels(detector), FrameRegistry(), bus,
        face_recognizer=None,
    )
    worker._open = lambda: cap  # подменяем RTSP-открытие

    worker.start()
    # ждём, пока цикл продолжит работу ПОСЛЕ исключения (доказывает устойчивость)
    deadline = time.time() + 5
    while detector.calls_after_raise < 3 and time.time() < deadline:
        time.sleep(0.02)
    worker.stop()
    worker.join(timeout=5)

    assert detector.raised, "детектор должен был бросить исключение"
    assert detector.calls_after_raise >= 1, "поток продолжил работу после ошибки"
    assert not worker.is_alive(), "поток завершился чисто"
    assert cap.released, "cap освобождён в finally"
    assert len(worker._seen) <= settings.SEEN_TRACK_CAP, "_seen ограничен (нет утечки)"
    assert any(e["event_type"] == "PersonDetected" for e in bus.events), \
        "события публиковались"


# ---------- тест 2: оркестратор перезапускает мёртвый воркер ----------
class _FakeWorker:
    created = 0

    def __init__(self, cfg, *_args):
        _FakeWorker.created += 1
        self.cfg = cfg
        self.store_id = cfg["storeId"]
        self.face_index = None
        self._alive = True

    def start(self):
        pass

    def stop(self):
        self._alive = False

    def is_alive(self):
        return self._alive


class _FakeConfigClient:
    def fetch(self):
        return [{"id": "c1", "storeId": "s1", "name": "Test",
                 "rtspUrl": "rtsp://x", "fpsLimit": 15,
                 "zones": [], "behavior": {}, "modelOverride": None}]


class _FakeFaces:
    ready = False


def test_orchestrator_restarts_dead_worker():
    _FakeWorker.created = 0
    orig = orchestrator_main.CameraWorker
    orchestrator_main.CameraWorker = _FakeWorker
    try:
        orch = orchestrator_main.Orchestrator(
            _FakeConfigClient(), None, None, _FakeFaces(), None, None, None,
        )
        orch.sync()
        assert "c1" in orch._workers
        assert _FakeWorker.created == 1

        # имитируем гибель потока воркера
        orch._workers["c1"][0]._alive = False

        orch.sync()  # должен обнаружить мёртвый и пересоздать
        assert "c1" in orch._workers
        assert _FakeWorker.created == 2, "мёртвый воркер перезапущен"
        assert orch._workers["c1"][0].is_alive()
    finally:
        orchestrator_main.CameraWorker = orig


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
