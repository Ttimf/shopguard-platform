import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common';
import {
  EngineEvent,
  EngineEventView,
  ListEngineEventsDto,
} from '@app/contracts';

@Injectable()
export class EventStore {
  constructor(private readonly prisma: PrismaService) {}

  /** Сохранить событие движка в EventLog. */
  async save(event: EngineEvent): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        id: event.eventId,
        storeId: event.storeId,
        cameraId: event.cameraId ?? null,
        trackingId: event.trackingId ?? null,
        eventType: String(event.eventType),
        timestamp: new Date(event.timestamp),
        confidence: event.confidence ?? null,
        modelVersion: event.modelVersion ?? null,
        metadata: (event.metadata as object) ?? undefined,
      },
    });
  }

  async list(dto: ListEngineEventsDto): Promise<EngineEventView[]> {
    const storeIds = await this.ownedStoreIds(dto.ownerId, dto.storeId);
    if (storeIds.length === 0) return [];
    const events = await this.prisma.eventLog.findMany({
      where: {
        storeId: { in: storeIds },
        ...(dto.cameraId ? { cameraId: dto.cameraId } : {}),
        ...(dto.eventType ? { eventType: dto.eventType } : {}),
        ...(dto.modelVersion ? { modelVersion: dto.modelVersion } : {}),
        ...(dto.from || dto.to
          ? {
              timestamp: {
                ...(dto.from ? { gte: new Date(dto.from) } : {}),
                ...(dto.to ? { lte: new Date(dto.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: Math.min(dto.limit ?? 100, 500),
    });
    return events.map((e) => this.view(e));
  }

  async get(ownerId: string, id: string): Promise<EngineEventView> {
    const event = await this.prisma.eventLog.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Событие не найдено');
    const storeIds = await this.ownedStoreIds(ownerId);
    if (!storeIds.includes(event.storeId)) {
      throw new ForbiddenException('Нет доступа к событию');
    }
    return this.view(event);
  }

  /** id магазинов владельца (опц. сузить до одного, проверив владение). */
  private async ownedStoreIds(
    ownerId: string,
    storeId?: string,
  ): Promise<string[]> {
    const stores = await this.prisma.store.findMany({
      where: { ownerId, ...(storeId ? { id: storeId } : {}) },
      select: { id: true },
    });
    return stores.map((s) => s.id);
  }

  private view(e: {
    id: string;
    storeId: string;
    cameraId: string | null;
    trackingId: number | null;
    eventType: string;
    timestamp: Date;
    confidence: number | null;
    modelVersion: string | null;
    metadata: unknown;
    createdAt: Date;
  }): EngineEventView {
    return {
      eventId: e.id,
      storeId: e.storeId,
      cameraId: e.cameraId,
      trackingId: e.trackingId,
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      confidence: e.confidence,
      modelVersion: e.modelVersion,
      metadata: (e.metadata as Record<string, unknown>) ?? null,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
