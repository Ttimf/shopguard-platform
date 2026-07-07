import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { EngineEvent, EVENTS_STREAM } from '@app/contracts';

/**
 * Event Bus (общий продюсер): публикация событий движка в Redis Stream.
 * Событие — JSON в поле `data`. Используется любым сервисом-продюсером.
 */
@Injectable()
export class EventBus implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }

  async publish(event: EngineEvent): Promise<void> {
    try {
      await this.redis.xadd(EVENTS_STREAM, '*', 'data', JSON.stringify(event));
    } catch {
      // шина не должна ронять основной поток
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
