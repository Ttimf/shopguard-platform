import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ReliableStreamConsumer } from '@app/common';
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
  private consumer?: ReliableStreamConsumer;

  constructor(private readonly tracking: TrackingService) {}

  async onModuleInit() {
    this.consumer = new ReliableStreamConsumer({
      stream: EVENTS_STREAM,
      group: GROUP,
      consumer: CONSUMER,
      logger: this.logger,
      handle: (event) => this.route(event),
    });
    await this.consumer.start();
    this.logger.log('tracking-engine запущен');
  }

  onModuleDestroy() {
    this.consumer?.stop();
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
}
