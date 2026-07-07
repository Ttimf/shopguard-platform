import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.model_manager import ModelManager, _derive_version  # noqa: E402


def _make_models(root):
    os.makedirs(os.path.join(root, "official"), exist_ok=True)
    os.makedirs(os.path.join(root, "custom"), exist_ok=True)
    for rel in ("official/shopguard_v1.pt", "official/shopguard_v2.pt",
                "custom/customer_model_001.pt"):
        with open(os.path.join(root, rel), "wb") as f:
            f.write(b"0" * 1024)  # 1 KB заглушка


def _fake_factory():
    calls = []
    return calls, (lambda path: calls.append(path))


def test_derive_version():
    assert _derive_version("shopguard_v1.pt") == "v1"
    assert _derive_version("shopguard_v12.pt") == "v12"
    assert _derive_version("customer_model_001.pt") == "customer_model_001"


def test_missing_env_raises():
    try:
        ModelManager("models", None)
        assert False, "должно бросить"
    except ValueError:
        pass


def test_load_and_info():
    with tempfile.TemporaryDirectory() as root:
        _make_models(root)
        calls, factory = _fake_factory()
        mm = ModelManager(root, "shopguard_v1.pt", detector_factory=factory)
        info = mm.load()
        assert info.name == "shopguard_v1.pt"
        assert info.version == "v1"
        assert info.loaded is True
        assert info.size_bytes == 1024
        assert mm.current_info().to_api() == {
            "currentModel": "shopguard_v1.pt",
            "version": "v1",
            "loaded": True,
        }
        assert len(calls) == 1  # модель загружена один раз при load()


def test_switch_changes_current_and_generation():
    with tempfile.TemporaryDirectory() as root:
        _make_models(root)
        _, factory = _fake_factory()
        mm = ModelManager(root, "shopguard_v1.pt", detector_factory=factory)
        mm.load()
        g0 = mm.generation
        info = mm.switch("shopguard_v2.pt")
        assert info.version == "v2"
        assert mm.current_info().name == "shopguard_v2.pt"
        assert mm.generation == g0 + 1


def test_switch_missing_raises():
    with tempfile.TemporaryDirectory() as root:
        _make_models(root)
        _, factory = _fake_factory()
        mm = ModelManager(root, "shopguard_v1.pt", detector_factory=factory)
        mm.load()
        try:
            mm.switch("shopguard_v999.pt")
            assert False, "должно бросить"
        except FileNotFoundError:
            pass
        # текущая модель не изменилась после неудачного switch
        assert mm.current_info().name == "shopguard_v1.pt"


def test_resolve_custom_and_available():
    with tempfile.TemporaryDirectory() as root:
        _make_models(root)
        _, factory = _fake_factory()
        mm = ModelManager(root, "customer_model_001.pt", detector_factory=factory)
        info = mm.load()
        assert info.name == "customer_model_001.pt"
        avail = mm.available()
        assert "shopguard_v1.pt" in avail["official"]
        assert "customer_model_001.pt" in avail["custom"]


def test_create_detector_uses_current():
    with tempfile.TemporaryDirectory() as root:
        _make_models(root)
        calls, factory = _fake_factory()
        mm = ModelManager(root, "shopguard_v1.pt", detector_factory=factory)
        mm.load()
        calls.clear()
        mm.create_detector()
        assert calls[0].endswith("shopguard_v1.pt")


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
