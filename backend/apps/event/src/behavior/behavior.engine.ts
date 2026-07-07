import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { EngineEvent, EngineEventType, EVENTS_STREAM } from '@app/contracts';
import { BehaviorService } from './behavior.service';

const GROUP = 'behavior-engine'; // отдельная группа — не мешает event/tracking
const CONSUMER = 'behavior-1';

/**
 * Читает шину (своя consumer group) и наполняет сессии поведения.
 * PersonExited закрывает сессию с финальным risk score.
 */
@Injectable()
export class BehaviorEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('BehaviorEngine');
  private readonly reader: Redis;
  private running = false;

  constructor(private readonly behavior: BehaviorService) {
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
    this.logger.log('behavior-engine запущен');
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
      if (event) await this.route(event);
    } catch (e: any) {
      this.logger.error(`Ошибка обработки ${id}: ${e?.message}`);
    } finally {
      await this.reader.xack(EVENTS_STREAM, GROUP, id);
    }
  }

  private async route(e: EngineEvent): Promise<void> {
    const tid = e.trackingId != null ? String(e.trackingId) : null;
    switch (e.eventType) {
      case EngineEventType.PERSON_DETECTED:
        if (tid) await this.behavior.onDetected(e.storeId, tid, e.cameraId ?? undefined);
        break;
      case EngineEventType.PRODUCT_TAKEN:
        if (tid) await this.behavior.onProductTaken(e.storeId, tid);
        break;
      case EngineEventType.PRODUCT_RETURNED:
        if (tid) await this.behavior.onProductReturned(e.storeId, tid);
        break;
      case EngineEventType.SUSPICIOUS_ACTIVITY:
        if (tid) await this.behavior.onSuspicious(e.storeId, tid);
        break;
      case EngineEventType.PERSON_EXITED:
        if (tid) await this.behavior.onExited(e.storeId, tid);
        break;
      // CameraOffline/CameraOnline/ModelSwitched — потребляются, сессию не меняют
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
