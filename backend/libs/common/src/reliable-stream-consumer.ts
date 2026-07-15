import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { EngineEvent } from '@app/contracts';

export interface ReliableStreamOptions {
  stream: string;
  group: string;
  consumer: string;
  /** Бизнес-обработчик события (без инфраструктуры чтения/ack). */
  handle: (event: EngineEvent) => Promise<void>;
  logger?: Logger;
  /** Всего попыток на сообщение (in-memory), затем — в DLQ. По умолчанию 3. */
  maxAttempts?: number;
  /** Мин. idle pending-сообщения для XAUTOCLAIM (мс). По умолчанию 60000. */
  claimIdleMs?: number;
  /** Как часто запускать XAUTOCLAIM (мс). По умолчанию 30000. */
  claimEveryMs?: number;
}

/**
 * Надёжный консьюмер Redis Stream (аддитивная инфраструктура — бизнес-логику
 * не содержит). Гарантии:
 *   • Retry — сообщение переобрабатывается до maxAttempts перед ACK;
 *   • DLQ — исчерпавшие попытки / непарсимые уходят в поток `<stream>.dlq`;
 *   • XAUTOCLAIM — «зависшие» pending (упавший/зависший консьюмер) забираются
 *     и переобрабатываются;
 *   • ACK только после успеха ИЛИ отправки в DLQ → нет потери при временных
 *     ошибках (at-least-once).
 */
export class ReliableStreamConsumer {
  private readonly redis: Redis;
  private readonly log: Logger;
  private readonly dlqStream: string;
  private readonly maxAttempts: number;
  private readonly claimIdleMs: number;
  private readonly claimEveryMs: number;
  private running = false;
  private lastClaim = 0;

  constructor(private readonly opts: ReliableStreamOptions) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    });
    this.log = opts.logger ?? new Logger('ReliableStream');
    this.dlqStream = `${opts.stream}.dlq`;
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.claimIdleMs = opts.claimIdleMs ?? 60000;
    this.claimEveryMs = opts.claimEveryMs ?? 30000;
  }

  async start(): Promise<void> {
    await this.ensureGroup();
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
    this.redis.disconnect();
  }

  private async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.opts.stream,
        this.opts.group,
        '$',
        'MKSTREAM',
      );
    } catch (e: any) {
      if (!String(e?.message).includes('BUSYGROUP')) throw e;
    }
  }

  private async loop(): Promise<void> {
    const { stream, group, consumer } = this.opts;
    while (this.running) {
      try {
        if (Date.now() - this.lastClaim > this.claimEveryMs) {
          await this.reclaimPending();
          this.lastClaim = Date.now();
        }
        const res = await this.redis.xreadgroup(
          'GROUP', group, consumer, 'COUNT', 20, 'BLOCK', 5000,
          'STREAMS', stream, '>',
        );
        if (!res) continue;
        const [, messages] = (res as any[])[0];
        for (const [id, flat] of messages) {
          await this.process(id, flat);
        }
      } catch (e: any) {
        if (this.running) {
          this.log.error(`Ошибка чтения ${stream}: ${e?.message}`);
          await this.sleep(1000);
        }
      }
    }
  }

  /** Восстановление «зависших» pending-сообщений (упавший/зависший консьюмер). */
  private async reclaimPending(): Promise<void> {
    const { stream, group, consumer } = this.opts;
    try {
      let cursor = '0';
      do {
        const res: any = await (this.redis as any).xautoclaim(
          stream, group, consumer, this.claimIdleMs, cursor, 'COUNT', 50,
        );
        cursor = res?.[0] ?? '0';
        const claimed: any[] = res?.[1] ?? [];
        for (const [id, flat] of claimed) {
          if (!flat) {
            await this.redis.xack(stream, group, id); // сообщение удалено из стрима
            continue;
          }
          const delivered = await this.deliveryCount(id);
          if (delivered > this.maxAttempts) {
            // «poison pill»: многократно переполучено и не обработано → в DLQ
            await this.toDlq(id, flat, 'poison-pill', delivered);
            await this.redis.xack(stream, group, id);
            continue;
          }
          await this.process(id, flat);
        }
      } while (cursor !== '0');
    } catch (e: any) {
      this.log.error(`XAUTOCLAIM ${stream}: ${e?.message}`);
    }
  }

  /** Число доставок сообщения (для защиты от бесконечного reclaim). */
  private async deliveryCount(id: string): Promise<number> {
    try {
      const res: any = await this.redis.xpending(
        this.opts.stream, this.opts.group, id, id, 1,
      );
      const dc = res?.[0]?.[3];
      return dc ? Number(dc) : 1;
    } catch {
      return 1;
    }
  }

  /** Обработка одного сообщения с retry; при исчерпании попыток — в DLQ. */
  private async process(id: string, flat: string[]): Promise<void> {
    const { stream, group } = this.opts;
    const event = this.parse(flat);
    if (!event) {
      await this.toDlq(id, flat, 'parse-failed', 0);
      await this.redis.xack(stream, group, id);
      return;
    }
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        await this.opts.handle(event);
        await this.redis.xack(stream, group, id);
        return;
      } catch (e: any) {
        this.log.error(
          `Обработка ${id} попытка ${attempt}/${this.maxAttempts}: ${e?.message}`,
        );
        if (attempt < this.maxAttempts) await this.sleep(this.backoff(attempt));
      }
    }
    await this.toDlq(id, flat, 'max-retries', this.maxAttempts);
    await this.redis.xack(stream, group, id);
  }

  private async toDlq(
    id: string,
    flat: string[],
    reason: string,
    attempts: number,
  ): Promise<void> {
    try {
      await this.redis.xadd(
        this.dlqStream, '*',
        'origId', id,
        'origStream', this.opts.stream,
        'group', this.opts.group,
        'reason', reason,
        'attempts', String(attempts),
        'failedAt', new Date().toISOString(),
        ...flat,
      );
      this.log.warn(`→ DLQ ${this.dlqStream}: ${id} (${reason})`);
    } catch (e: any) {
      this.log.error(`Не удалось записать в DLQ ${id}: ${e?.message}`);
    }
  }

  private parse(flat: string[]): EngineEvent | null {
    const idx = flat.indexOf('data');
    if (idx < 0) return null;
    try {
      return JSON.parse(flat[idx + 1]) as EngineEvent;
    } catch {
      return null;
    }
  }

  private backoff(attempt: number): number {
    return Math.min(1000 * 2 ** (attempt - 1), 5000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
