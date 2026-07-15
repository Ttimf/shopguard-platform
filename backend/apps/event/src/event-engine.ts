import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EngineEvent, EVENTS_STREAM } from '@app/contracts';
import { EventBus, ReliableStreamConsumer } from '@app/common';
import { EventStore } from './event.store';
import { EventRule, RuleContext } from './rules/rule.interface';

const GROUP = 'event-engine';
const CONSUMER = 'event-engine-1';

/**
 * Ядро событий: читает шину (Redis Stream), сохраняет каждое событие в EventLog
 * и прогоняет через расширяемый пайплайн правил (правила могут порождать новые
 * события через EventBus). Производные события снова проходят через движок.
 */
@Injectable()
export class EventEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EventEngine');
  private readonly ctx: RuleContext;
  private consumer?: ReliableStreamConsumer;

  constructor(
    private readonly store: EventStore,
    private readonly bus: EventBus,
    @Inject('EVENT_RULES') private readonly rules: EventRule[],
  ) {
    this.ctx = { emit: (e) => this.bus.publish(e) };
  }

  async onModuleInit() {
    this.consumer = new ReliableStreamConsumer({
      stream: EVENTS_STREAM,
      group: GROUP,
      consumer: CONSUMER,
      logger: this.logger,
      handle: (event) => this.process(event),
    });
    await this.consumer.start();
    this.logger.log(
      `движок запущен, правил: ${this.rules.map((r) => r.name).join(', ') || '—'}`,
    );
  }

  onModuleDestroy() {
    this.consumer?.stop();
  }

  private async process(event: EngineEvent): Promise<void> {
    await this.store.save(event);
    for (const rule of this.rules) {
      try {
        await rule.handle(event, this.ctx);
      } catch (e: any) {
        this.logger.error(`Правило ${rule.name}: ${e?.message}`);
      }
    }
  }
}
