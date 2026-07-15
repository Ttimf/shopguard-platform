import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ReliableStreamConsumer } from '@app/common';
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
  private consumer?: ReliableStreamConsumer;

  constructor(private readonly alerts: AlertService) {}

  async onModuleInit() {
    this.consumer = new ReliableStreamConsumer({
      stream: EVENTS_STREAM,
      group: GROUP,
      consumer: CONSUMER,
      logger: this.logger,
      handle: (event) => this.route(event),
    });
    await this.consumer.start();
    this.logger.log('alert-engine запущен');
  }

  onModuleDestroy() {
    this.consumer?.stop();
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
}
