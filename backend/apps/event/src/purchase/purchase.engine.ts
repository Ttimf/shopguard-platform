import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ReliableStreamConsumer } from '@app/common';
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
  private consumer?: ReliableStreamConsumer;

  constructor(private readonly purchase: PurchaseService) {}

  async onModuleInit() {
    this.consumer = new ReliableStreamConsumer({
      stream: EVENTS_STREAM,
      group: GROUP,
      consumer: CONSUMER,
      logger: this.logger,
      handle: (event) => this.route(event),
    });
    await this.consumer.start();
    this.logger.log('purchase-matching запущен');
  }

  onModuleDestroy() {
    this.consumer?.stop();
  }

  private async route(event: EngineEvent): Promise<void> {
    if (
      event.eventType === EngineEventType.PERSON_EXITED &&
      event.trackingId != null
    ) {
      await this.purchase.onExited(event.storeId, String(event.trackingId));
    }
  }
}
