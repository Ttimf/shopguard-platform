import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ALERTS_CHANNEL, REDIS_STREAMS } from '@app/contracts';
import { EventService } from './event.service';
import { TelegramSender } from './telegram.sender';

const GROUP = 'notification';
const CONSUMER = 'notification-1';

/**
 * Читает Redis Stream detection.events (consumer group), пишет Event в БД
 * и публикует живую тревогу в канал ALERTS_CHANNEL (для WS в gateway).
 */
@Injectable()
export class StreamConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('StreamConsumer');
  private readonly reader: Redis;
  private readonly publisher: Redis;
  private running = false;

  constructor(
    private readonly events: EventService,
    private readonly telegram: TelegramSender,
  ) {
    const opts = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    };
    this.reader = new Redis(opts);
    this.publisher = new Redis(opts);
  }

  async onModuleInit() {
    await this.ensureGroup();
    this.running = true;
    void this.loop();
  }

  async onModuleDestroy() {
    this.running = false;
    this.reader.disconnect();
    this.publisher.disconnect();
  }

  private async ensureGroup() {
    try {
      await this.reader.xgroup(
        'CREATE',
        REDIS_STREAMS.DETECTION_EVENTS,
        GROUP,
        '$',
        'MKSTREAM',
      );
    } catch (e: any) {
      if (!String(e?.message).includes('BUSYGROUP')) throw e;
    }
  }

  private async loop() {
    while (this.running) {
      try {
        const res = await this.reader.xreadgroup(
          'GROUP',
          GROUP,
          CONSUMER,
          'COUNT',
          10,
          'BLOCK',
          5000,
          'STREAMS',
          REDIS_STREAMS.DETECTION_EVENTS,
          '>',
        );
        if (!res) continue;
        const [, messages] = (res as any[])[0];
        for (const [id, flat] of messages) {
          await this.handle(id, this.toObject(flat));
        }
      } catch (e: any) {
        if (this.running) {
          this.logger.error(`Ошибка чтения стрима: ${e?.message}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  private async handle(id: string, fields: Record<string, string>) {
    try {
      const result = await this.events.persist(fields);
      if (result) {
        const { view, telegramChatId } = result;
        await this.publisher.publish(
          ALERTS_CHANNEL,
          JSON.stringify({ storeId: view.storeId, event: view }),
        );
        this.logger.log(`Событие ${view.type} (${view.cameraName}) сохранено`);
        if (telegramChatId) {
          await this.telegram.send(telegramChatId, view);
        }
      }
    } catch (e: any) {
      this.logger.error(`Ошибка обработки ${id}: ${e?.message}`);
    } finally {
      await this.reader.xack(REDIS_STREAMS.DETECTION_EVENTS, GROUP, id);
    }
  }

  private toObject(flat: string[]): Record<string, string> {
    const obj: Record<string, string> = {};
    for (let i = 0; i < flat.length; i += 2) obj[flat[i]] = flat[i + 1];
    return obj;
  }
}
