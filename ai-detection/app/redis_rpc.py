"""
Клиент request/reply к NestJS-микросервисам поверх Redis-транспорта.

NestJS Redis transport использует pub/sub:
  - запрос публикуется в канал `<pattern>` как JSON {pattern, data, id};
  - ответ приходит в канал `<pattern>.reply` как JSON {id, response, err, isDisposed}.
Так ai-detection (Python) вызывает camera-service, не дублируя его логику.
"""
import json
import time
import uuid

import redis


class RpcError(Exception):
    pass


class RedisRpc:
    def __init__(self, host: str, port: int, password: str | None):
        self._redis = redis.Redis(
            host=host,
            port=port,
            password=password,
            decode_responses=True,
            protocol=2,  # RESP2 — совместимо со старыми Redis (нет HELLO)
        )

    def request(self, pattern: str, data: dict, timeout: float = 10.0):
        request_id = uuid.uuid4().hex
        reply_channel = f"{pattern}.reply"

        pubsub = self._redis.pubsub(ignore_subscribe_messages=True)
        pubsub.subscribe(reply_channel)
        try:
            packet = {"pattern": pattern, "data": data, "id": request_id}
            self._redis.publish(pattern, json.dumps(packet))

            deadline = time.time() + timeout
            while time.time() < deadline:
                message = pubsub.get_message(timeout=deadline - time.time())
                if not message or message.get("type") != "message":
                    continue
                payload = json.loads(message["data"])
                if payload.get("id") != request_id:
                    continue
                if payload.get("err"):
                    raise RpcError(str(payload["err"]))
                return payload.get("response")
        finally:
            pubsub.close()

        raise RpcError(f"Нет ответа на {pattern} за {timeout}с")

    def ping(self) -> bool:
        return bool(self._redis.ping())
