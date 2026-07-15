import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ReliableStreamConsumer } from '@app/common';
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
  private consumer?: ReliableStreamConsumer;

  constructor(private readonly behavior: BehaviorService) {}

  async onModuleInit() {
    this.consumer = new ReliableStreamConsumer({
      stream: EVENTS_STREAM,
      group: GROUP,
      consumer: CONSUMER,
      logger: this.logger,
      handle: (event) => this.route(event),
    });
    await this.consumer.start();
    this.logger.log('behavior-engine запущен');
  }

  onModuleDestroy() {
    this.consumer?.stop();
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
}
