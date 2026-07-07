import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { EngineEvent, EngineEventType, EVENTS_STREAM } from '@app/contracts';
import { PurchaseService } from './purchase.service';

const GROUP = 'purchase-matching'; // отдельная группа
const CONSUMER = 'purchase-1';

/**
 * Читает шину (своя consumer group). Триггер сопоставления — PersonExited
 * (человек ушёл → проверяем оплату его товаров).
 */
@Injectable()
export class PurchaseEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PurchaseEngine');
  private readonly reader: Redis;
  private running = false;

  constructor(private readonly purchase: PurchaseService) {
    this.reader = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }

  async onModuleInit() {
    await this.ensureGroup();
    this.running = true;
    void this.loop();
    this.logger.log('purchase-matching запущен');
  }

  onModuleDestroy() {
    this.running = false;
    this.reader.disconnect();
  }

  private async ensureGroup() {
    try {
      await this.reader.xgroup('CREATE', EVENTS_STREAM, GROUP, '$', 'MKSTREAM');
    } catch (e: any) {
      if (!String(e?.message).includes('BUSYGROUP')) throw e;
    }
  }

  private async loop() {
    while (this.running) {
      try {
        const res = await this.reader.xreadgroup(
          'GROUP', GROUP, CONSUMER, 'COUNT', 20, 'BLOCK', 5000,
          'STREAMS', EVENTS_STREAM, '>',
        );
        if (!res) continue;
        const [, messages] = (res as any[])[0];
        for (const [id, flat] of messages) {
          await this.handle(id, flat);
        }
      } catch (e: any) {
        if (this.running) {
          this.logger.error(`Ошибка чтения шины: ${e?.message}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  private async handle(id: string, flat: string[]) {
    try {
      const event = this.parse(flat);
      if (
        event &&
        event.eventType === EngineEventType.PERSON_EXITED &&
        event.trackingId != null
      ) {
        await this.purchase.onExited(event.storeId, String(event.trackingId));
      }
    } catch (e: any) {
      this.logger.error(`Ошибка обработки ${id}: ${e?.message}`);
    } finally {
      await this.reader.xack(EVENTS_STREAM, GROUP, id);
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
}
