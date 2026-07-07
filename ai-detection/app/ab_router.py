"""
A/B-маршрутизация моделей по магазинам.

Приоритет выбора модели на камеру:
  1) явный override магазина (Store.modelOverride);
  2) canary-раскатка: X% магазинов на новой модели (детерминированно по хэшу storeId);
  3) None → глобальная модель по умолчанию (ModelManager).

Детерминированность по хэшу гарантирует, что один магазин всегда в одной группе
(нет «дёрганья» между моделями), а разбиение стабильно между перезапусками.
"""
import hashlib


def _bucket(store_id: str) -> int:
    digest = hashlib.md5(store_id.encode("utf-8")).hexdigest()
    return int(digest, 16) % 100


def resolve_model(
    store_id: str,
    override: str | None,
    canary_model: str | None,
    canary_percent: int,
) -> str | None:
    """Модель для магазина (имя файла) либо None → модель по умолчанию."""
    if override:
        return override
    if canary_model and canary_percent > 0 and store_id:
        if _bucket(store_id) < canary_percent:
            return canary_model
    return None
