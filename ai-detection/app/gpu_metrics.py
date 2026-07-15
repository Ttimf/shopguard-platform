"""
GPU-метрики через NVML (pynvml). Без GPU/pynvml — graceful fallback:
статические поля = None, live-метрики = None (сервис продолжает работать на CPU).
"""
try:
    import pynvml  # из пакета nvidia-ml-py
    _NVML = True
except Exception:  # noqa: BLE001 — pynvml может отсутствовать (CPU-режим)
    pynvml = None
    _NVML = False


def _decode(v):
    return v.decode() if isinstance(v, bytes) else v


class GpuMetrics:
    def __init__(self):
        self.available = False
        self._h = None
        if _NVML:
            try:
                pynvml.nvmlInit()
                self._h = pynvml.nvmlDeviceGetHandleByIndex(0)
                self.available = True
            except Exception:  # noqa: BLE001
                self.available = False

    def static_info(self) -> dict:
        """Статические поля для регистрации: имя GPU, VRAM, CUDA, драйвер."""
        if not self.available:
            return {"gpuName": None, "gpuMemory": None, "cuda": None,
                    "driverVersion": None}
        info = {"gpuName": None, "gpuMemory": None, "cuda": None,
                "driverVersion": None}
        try:
            info["gpuName"] = _decode(pynvml.nvmlDeviceGetName(self._h))
        except Exception:  # noqa: BLE001
            pass
        try:
            info["gpuMemory"] = pynvml.nvmlDeviceGetMemoryInfo(self._h).total // (1024 * 1024)
        except Exception:  # noqa: BLE001
            pass
        try:
            info["driverVersion"] = _decode(pynvml.nvmlSystemGetDriverVersion())
        except Exception:  # noqa: BLE001
            pass
        try:
            raw = pynvml.nvmlSystemGetCudaDriverVersion()
            info["cuda"] = f"{raw // 1000}.{(raw % 1000) // 10}"
        except Exception:  # noqa: BLE001
            pass
        return info

    def live(self) -> dict:
        """Живые метрики для heartbeat: загрузка/VRAM/температура/мощность."""
        out = {"gpuUsage": None, "vramUsed": None, "temperature": None,
               "power": None}
        if not self.available:
            return out
        try:
            out["gpuUsage"] = pynvml.nvmlDeviceGetUtilizationRates(self._h).gpu
        except Exception:  # noqa: BLE001
            pass
        try:
            out["vramUsed"] = pynvml.nvmlDeviceGetMemoryInfo(self._h).used // (1024 * 1024)
        except Exception:  # noqa: BLE001
            pass
        try:
            out["temperature"] = pynvml.nvmlDeviceGetTemperature(
                self._h, pynvml.NVML_TEMPERATURE_GPU)
        except Exception:  # noqa: BLE001
            pass
        try:
            out["power"] = pynvml.nvmlDeviceGetPowerUsage(self._h) // 1000  # Вт
        except Exception:  # noqa: BLE001
            pass
        return out
