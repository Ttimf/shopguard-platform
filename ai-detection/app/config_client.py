"""Получение конфигурации камер из camera-service (через Redis RPC)."""
from .redis_rpc import RedisRpc
from . import settings


class ConfigClient:
    def __init__(self, rpc: RedisRpc, worker_id: str | None = None):
        self._rpc = rpc
        self._worker_id = worker_id  # для шардинга камер между воркерами

    def fetch(self) -> list[dict]:
        """Камеры, назначенные ЭТОМУ воркеру (шардинг по workerId на backend).
        Без worker_id backend отдаёт все камеры (обратная совместимость)."""
        data = {"workerId": self._worker_id} if self._worker_id else {}
        result = self._rpc.request(settings.CONFIG_LIST_PATTERN, data)
        return result or []

    def fetch_blacklist(self) -> list[dict]:
        """Записи чёрного списка: [{storeId, name, photoKey}]."""
        result = self._rpc.request(settings.BLACKLIST_CONFIG_PATTERN, {})
        return result or []
