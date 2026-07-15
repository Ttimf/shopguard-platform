"""Тесты ReIDClient: разбор ответа ReID Service, fallback, сериализация."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.reid_client import ReIDClient  # noqa: E402


class _FakeRpc:
    def __init__(self, response=None, raise_exc=False):
        self.response = response
        self.raise_exc = raise_exc
        self.last = None

    def request(self, pattern, data, timeout=None):
        self.last = (pattern, data)
        if self.raise_exc:
            raise RuntimeError("service down")
        return self.response


def test_client_parses_service_response():
    rpc = _FakeRpc(response={"globalPersonId": "g1", "similarity": 0.9, "matched": True})
    gid, sim, matched = ReIDClient(rpc).identify(
        np.array([1, 0, 0], dtype=np.float32), "camA", "3", 0.8
    )
    assert gid == "g1" and sim == 0.9 and matched is True
    assert rpc.last[0] == "reid.identify"
    assert isinstance(rpc.last[1]["embedding"], list)  # эмбеддинг сериализован


def test_client_fallback_on_rpc_error():
    gid, sim, matched = ReIDClient(_FakeRpc(raise_exc=True)).identify(
        None, "camA", "5", 0.8
    )
    assert gid == "camA:5" and sim == 0.0 and matched is False  # стабильный fallback


def test_client_sends_none_embedding():
    rpc = _FakeRpc(response={"globalPersonId": "g2", "similarity": 0.0, "matched": False})
    ReIDClient(rpc).identify(None, "camB", "1", 0.5)
    assert rpc.last[1]["embedding"] is None


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
