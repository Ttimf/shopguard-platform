"""
Управление моделями YOLO (production-ready).

Отвечает за выбор/валидацию/метаданные модели и выдачу детекторов.
Модель НЕ загружается напрямую в main.py — всё идёт через ModelManager.

Архитектурные принципы:
  - путь к модели только из окружения (YOLO_MODEL), без хардкода;
  - детектор создаётся на камеру (create_detector) — трекинг ByteTrack per-instance
    не ломается;
  - `generation` меняется при switch() → воркеры пересоздают детектор (hot-reload);
  - загрузчик детектора инъектируется (DIP) — тестируется без torch;
  - структура моделей: models/official/*.pt и models/custom/*.pt.
"""
import os
import re
import threading
import time
from dataclasses import dataclass
from typing import Callable

from . import settings
from .detector import Detector

DetectorFactory = Callable[[str], Detector]


@dataclass
class ModelInfo:
    name: str  # имя файла, напр. shopguard_v1.pt
    version: str  # v1 / v2 / имя пользовательской модели
    path: str  # разрешённый путь
    size_bytes: int
    load_seconds: float
    loaded: bool

    @property
    def size_human(self) -> str:
        mb = self.size_bytes / (1024 * 1024)
        return f"{mb:.1f} MB" if mb >= 1 else f"{self.size_bytes / 1024:.0f} KB"

    def to_api(self) -> dict:
        return {
            "currentModel": self.name,
            "version": self.version,
            "loaded": self.loaded,
        }


def _derive_version(name: str) -> str:
    m = re.search(r"_v(\d+)", name)
    if m:
        return f"v{m.group(1)}"
    return os.path.splitext(os.path.basename(name))[0]


class ModelManager:
    def __init__(
        self,
        models_dir: str,
        model_ref: str | None,
        detector_factory: DetectorFactory | None = None,
    ):
        if not model_ref:
            raise ValueError(
                "Не задана переменная окружения YOLO_MODEL — укажите путь к модели, "
                "например: YOLO_MODEL=models/official/shopguard_v1.pt"
            )
        self._models_dir = models_dir
        self._factory: DetectorFactory = detector_factory or (
            lambda path: Detector(
                path, settings.YOLO_DEVICE, settings.YOLO_CONFIDENCE
            )
        )
        self._lock = threading.Lock()
        self._generation = 0
        self._current_path = self._resolve(model_ref)
        self._info: ModelInfo | None = None

    # ---- публичное ----

    def load(self) -> ModelInfo:
        """Первичная загрузка текущей модели + вывод информации о ней."""
        info = self._measure(self._current_path)
        with self._lock:
            self._info = info
        self._log(info, switched=False)
        return info

    def switch(self, model_ref: str) -> ModelInfo:
        """Переключение на другую модель. Бросает FileNotFoundError, если файла нет."""
        path = self._resolve(model_ref)
        info = self._measure(path)
        with self._lock:
            self._current_path = path
            self._info = info
            self._generation += 1
        self._log(info, switched=True)
        return info

    def create_detector(self, model_ref: str | None = None) -> Detector:
        """
        Новый детектор (на камеру). model_ref — переопределение модели (A/B).
        Если файла нет — деградация на текущую модель с предупреждением.
        """
        if model_ref:
            try:
                path = self._resolve(model_ref)
            except FileNotFoundError:
                print(f"[models] модель '{model_ref}' не найдена — использую текущую")
                with self._lock:
                    path = self._current_path
        else:
            with self._lock:
                path = self._current_path
        return self._factory(path)

    def default_name(self) -> str | None:
        info = self.current_info()
        return info.name if info else None

    def version_of(self, model_ref: str | None) -> str | None:
        """Версия для тегирования событий: по override или текущая."""
        if model_ref:
            return _derive_version(os.path.basename(model_ref))
        info = self.current_info()
        return info.version if info else None

    def available_names(self) -> list[str]:
        a = self.available()
        return a["official"] + a["custom"]

    @property
    def generation(self) -> int:
        with self._lock:
            return self._generation

    def current_info(self) -> ModelInfo | None:
        with self._lock:
            return self._info

    def available(self) -> dict[str, list[str]]:
        """Список моделей в official/ и custom/ (для будущей админки/API)."""
        result: dict[str, list[str]] = {"official": [], "custom": []}
        for kind in result:
            folder = os.path.join(self._models_dir, kind)
            if os.path.isdir(folder):
                result[kind] = sorted(
                    f for f in os.listdir(folder) if f.endswith(".pt")
                )
        return result

    # ---- внутреннее ----

    def _resolve(self, ref: str) -> str:
        candidates = [
            ref,
            os.path.join(self._models_dir, ref),
            os.path.join(self._models_dir, "official", ref),
            os.path.join(self._models_dir, "custom", ref),
        ]
        for c in candidates:
            if os.path.isfile(c):
                return c
        raise FileNotFoundError(
            f"Модель не найдена: '{ref}'. Проверялись пути: {', '.join(candidates)}"
        )

    def _measure(self, path: str) -> ModelInfo:
        name = os.path.basename(path)
        size = os.path.getsize(path)
        started = time.time()
        self._factory(path)  # реальная загрузка — валидирует веса и даёт время загрузки
        return ModelInfo(
            name=name,
            version=_derive_version(name),
            path=path,
            size_bytes=size,
            load_seconds=time.time() - started,
            loaded=True,
        )

    def _log(self, info: ModelInfo, switched: bool) -> None:
        head = "Model switched:" if switched else "Loaded model:"
        print(
            f"\n{head}\n{info.name}\n\n"
            f"Version:\n{info.version}\n\n"
            f"Size:\n{info.size_human}\n\n"
            f"Load time:\n{info.load_seconds:.2f}s\n"
        )
