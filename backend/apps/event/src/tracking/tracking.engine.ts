import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { EngineEvent, EngineEventType, EVENTS_STREAM } from '@app/contracts';
import { TrackingService } from './tracking.service';

const GROUP = 'tracking-engine'; // отдельная группа — не мешает Event Engine
const CONSUMER = 'tracking-1';

/**
 * Читает шину событий (своя consumer group) и ведёт маршруты людей.
 * Реагирует на PersonDetected/PersonExited; прочие события игнорирует.
 */
@Injectable()
export class TrackingEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('TrackingEngine');
  private readonly reader: Redis;
  private running = false;

  constructor(private readonly tracking: TrackingService) {
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
    this.logger.log('tracking-engine запущен');
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

  private async route(event: EngineEvent): Promise<void> {
    if (event.eventType === EngineEventType.PERSON_DETECTED) {
      const trackingId = this.resolveId(event.trackingId);
      await this.tracking.onDetected(
        event.storeId,
        event.cameraId ?? 'unknown',
        trackingId,
      );
    } else if (event.eventType === EngineEventType.PERSON_EXITED) {
      if (event.trackingId == null) return; // нечего закрывать без id
      await this.tracking.onExited(
        event.storeId,
        event.cameraId ?? 'unknown',
        String(event.trackingId),
      );
    }
  }

  /** Использует существующий trackingId; иначе создаёт новый. */
  private resolveId(trackingId: number | string | null | undefined): string {
    return trackingId != null && trackingId !== ''
      ? String(trackingId)
      : randomUUID();
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
