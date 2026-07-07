import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { EngineEvent, EVENTS_STREAM } from '@app/contracts';
import { EventBus } from '@app/common';
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
  private readonly reader: Redis;
  private running = false;
  private readonly ctx: RuleContext;

  constructor(
    private readonly store: EventStore,
    private readonly bus: EventBus,
    @Inject('EVENT_RULES') private readonly rules: EventRule[],
  ) {
    this.reader = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    });
    this.ctx = { emit: (e) => this.bus.publish(e) };
  }

  async onModuleInit() {
    await this.ensureGroup();
    this.running = true;
    void this.loop();
    this.logger.log(
      `движок запущен, правил: ${this.rules.map((r) => r.name).join(', ') || '—'}`,
    );
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
      if (event) {
        await this.store.save(event);
        for (const rule of this.rules) {
          try {
            await rule.handle(event, this.ctx);
          } catch (e: any) {
            this.logger.error(`Правило ${rule.name}: ${e?.message}`);
          }
        }
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
