import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { EngineEvent, EngineEventType, EVENTS_STREAM } from '@app/contracts';
import { AlertService } from './alert.service';

const GROUP = 'alert-engine'; // отдельная группа
const CONSUMER = 'alert-1';

/**
 * Читает шину (своя consumer group). Принимает решения по PurchaseMismatch
 * (риск + покупка) и CameraOffline. CameraOnline потребляется (ack), тревог не создаёт.
 */
@Injectable()
export class AlertEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AlertEngine');
  private readonly reader: Redis;
  private running = false;

  constructor(private readonly alerts: AlertService) {
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
    this.logger.log('alert-engine запущен');
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
    switch (e.eventType) {
      case EngineEventType.PURCHASE_MISMATCH:
        await this.alerts.onPurchaseMismatch(e);
        break;
      case EngineEventType.CAMERA_OFFLINE:
        await this.alerts.onCameraOffline(e);
        break;
      // CameraOnline — потребляется, тревог не создаёт
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
