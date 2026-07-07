import { Injectable, Logger } from '@nestjs/common';
import { EventView } from '@app/contracts';
import { SnapshotStore } from './snapshot.store';

/**
 * Отправка тревог в Telegram. Токен бота — из TELEGRAM_BOT_TOKEN (.env).
 * Базовый URL API конфигурируем (TELEGRAM_API_BASE) — удобно для тестов.
 */
@Injectable()
export class TelegramSender {
  private readonly logger = new Logger('Telegram');
  private readonly token = process.env.TELEGRAM_BOT_TOKEN || '';
  private readonly base =
    process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';

  constructor(private readonly snapshots: SnapshotStore) {}

  get enabled(): boolean {
    return this.token.length > 0;
  }

  async send(chatId: string, event: EventView): Promise<void> {
    if (!this.enabled) return;
    const caption = this.caption(event);
    const photo = event.snapshotKey
      ? await this.snapshots.get(event.snapshotKey)
      : null;
    try {
      if (photo) {
        await this.sendPhoto(chatId, caption, photo);
      } else {
        await this.sendMessage(chatId, caption);
      }
    } catch (e: any) {
      this.logger.error(`Ошибка отправки в Telegram: ${e?.message}`);
    }
  }

  private caption(e: EventView): string {
    const when = new Date(e.createdAt).toLocaleString('ru-RU');
    if (e.type === 'BLACKLIST') {
      const who = e.personName ? `: <b>${e.personName}</b>` : '';
      return (
        `🚨 <b>Чёрный список</b>${who}\n` +
        `Камера: ${e.cameraName}\nВремя: ${when}`
      );
    }
    return (
      `🔴 <b>Подозрение на кражу</b>\n` +
      `Камера: ${e.cameraName}\nВремя: ${when}`
    );
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    await fetch(`${this.base}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
  }

  private async sendPhoto(
    chatId: string,
    caption: string,
    photo: Buffer,
  ): Promise<void> {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append(
      'photo',
      new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }),
      'snapshot.jpg',
    );
    await fetch(`${this.base}/bot${this.token}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
  }
}
