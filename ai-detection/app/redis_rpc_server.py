"""
Серверная сторона Redis RPC (тот же pub/sub-протокол, что у RedisRpc-клиента и
NestJS-микросервисов): подписка на канал `<pattern>`, ответ в `<pattern>.reply`.

Клиент публикует {"pattern","data","id"} в `<pattern>` и ждёт {"id","response"}
в `<pattern>.reply`. Здесь — приём запроса, вызов обработчика, публикация ответа.
Новый транспорт не вводится — переиспользуется существующий Redis pub/sub.
"""
import json
import threading
from typing import Callable

import redis

from . import settings


class RedisRpcServer:
    def __init__(self, host: str, port: int, password: str | None,
                 handlers: dict[str, Callable[[dict], object]]):
        self._redis = redis.Redis(
            host=host,
            port=port,
            password=password,
            decode_responses=True,
            protocol=2,
            **settings.REDIS_SSL_KWARGS,
        )
        self._handlers = handlers  # pattern -> fn(data) -> response
        self._stop = threading.Event()

    def stop(self) -> None:
        self._stop.set()

    def serve_forever(self) -> None:
        pubsub = self._redis.pubsub(ignore_subscribe_messages=True)
        for pattern in self._handlers:
            pubsub.subscribe(pattern)
        print(f"[rpc-server] слушаю: {', '.join(self._handlers)}")
        for message in pubsub.listen():
            if self._stop.is_set():
                break
            if message.get("type") != "message":
                continue
            channel = message["channel"]
            handler = self._handlers.get(channel)
            if handler is None:
                continue
            try:
                packet = json.loads(message["data"])
            except Exception:  # noqa: BLE001 — битый запрос игнорируем
                continue
            req_id = packet.get("id")
            data = packet.get("data") or {}
            try:
                response = handler(data)
                reply = {"id": req_id, "response": response, "isDisposed": True}
            except Exception as e:  # noqa: BLE001 — ошибка обработчика → err клиенту
                reply = {"id": req_id, "err": str(e), "isDisposed": True}
            try:
                self._redis.publish(f"{channel}.reply", json.dumps(reply))
            except Exception as e:  # noqa: BLE001
                print(f"[rpc-server] не удалось ответить: {e}")
        pubsub.close()
