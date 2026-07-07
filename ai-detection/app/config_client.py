"""Получение конфигурации камер из camera-service (через Redis RPC)."""
from .redis_rpc import RedisRpc
from . import settings


class ConfigClient:
    def __init__(self, rpc: RedisRpc):
        self._rpc = rpc

    def fetch(self) -> list[dict]:
        """Список активных камер с RTSP, зонами и порогами поведения."""
        result = self._rpc.request(settings.CONFIG_LIST_PATTERN, {})
        return result or []

    def fetch_blacklist(self) -> list[dict]:
        """Записи чёрного списка: [{storeId, name, photoKey}]."""
        result = self._rpc.request(settings.BLACKLIST_CONFIG_PATTERN, {})
        return result or []
