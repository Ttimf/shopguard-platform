import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService, EventBus } from '@app/common';
import { randomUUID } from 'crypto';
import {
  CreateStoreDto,
  EngineEventType,
  SetModelDto,
  SetTelegramDto,
  StoreView,
} from '@app/contracts';

const AI_URL = process.env.AI_DETECTION_URL ?? 'http://localhost:8000';

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async create(dto: CreateStoreDto): Promise<StoreView> {
    const store = await this.prisma.store.create({
      data: {
        ownerId: dto.ownerId,
        name: dto.name,
        address: dto.address ?? null,
      },
    });
    return this.view(store);
  }

  async list(ownerId: string): Promise<StoreView[]> {
    const stores = await this.prisma.store.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
    });
    return stores.map((s) => this.view(s));
  }

  async setTelegram(dto: SetTelegramDto): Promise<StoreView> {
    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
    });
    if (!store) throw new NotFoundException('Магазин не найден');
    if (store.ownerId !== dto.ownerId) {
      throw new ForbiddenException('Нет доступа к магазину');
    }
    const updated = await this.prisma.store.update({
      where: { id: dto.storeId },
      data: { telegramChatId: dto.chatId },
    });
    return this.view(updated);
  }

  /** A/B: закрепить модель за магазином (с проверкой, что модель существует). */
  async setModel(dto: SetModelDto): Promise<StoreView> {
    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
    });
    if (!store) throw new NotFoundException('Магазин не найден');
    if (store.ownerId !== dto.ownerId) {
      throw new ForbiddenException('Нет доступа к магазину');
    }
    if (dto.model) {
      const models = await this.listModels();
      if (!models.available.includes(dto.model)) {
        throw new BadRequestException(
          `Модель '${dto.model}' недоступна. Доступные: ${models.available.join(', ')}`,
        );
      }
    }
    const updated = await this.prisma.store.update({
      where: { id: dto.storeId },
      data: { modelOverride: dto.model },
    });
    await this.bus.publish({
      eventId: randomUUID(),
      storeId: dto.storeId,
      eventType: EngineEventType.MODEL_SWITCHED,
      timestamp: new Date().toISOString(),
      modelVersion: dto.model,
      metadata: { model: dto.model ?? 'default' },
    });
    return this.view(updated);
  }

  /** Доступные модели (из ai-detection). */
  async listModels(): Promise<{ available: string[]; default: string | null }> {
    try {
      const res = await fetch(`${AI_URL}/internal/models`);
      return (await res.json()) as { available: string[]; default: string | null };
    } catch {
      throw new ServiceUnavailableException('AI-сервис недоступен');
    }
  }

  private view(s: {
    id: string;
    name: string;
    address: string | null;
    telegramChatId: string | null;
    modelOverride: string | null;
    createdAt: Date;
  }): StoreView {
    return {
      id: s.id,
      name: s.name,
      address: s.address,
      telegramChatId: s.telegramChatId,
      modelOverride: s.modelOverride,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
