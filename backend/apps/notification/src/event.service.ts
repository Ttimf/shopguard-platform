import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common';
import {
  EventKind,
  EventStatusValue,
  EventView,
  ListEventsDto,
  UpdateEventStatusDto,
} from '@app/contracts';

type EventWithCamera = {
  id: string;
  cameraId: string;
  type: string;
  trackId: number | null;
  personName: string | null;
  confidence: number | null;
  snapshotKey: string | null;
  clipKey: string | null;
  modelVersion: string | null;
  status: string;
  createdAt: Date;
  camera: { name: string; storeId: string };
};

@Injectable()
export class EventService {
  constructor(private readonly prisma: PrismaService) {}

  /** Запись события из стрима detection.events. Возвращает view + chatId или null. */
  async persist(
    fields: Record<string, string>,
  ): Promise<{ view: EventView; telegramChatId: string | null } | null> {
    const camera = await this.prisma.camera.findUnique({
      where: { id: fields.cameraId },
      include: { store: true },
    });
    if (!camera) return null; // камера удалена — событие некому показывать

    const event = await this.prisma.event.create({
      data: {
        cameraId: fields.cameraId,
        type: fields.type === 'blacklist' ? 'BLACKLIST' : 'THEFT',
        trackId: fields.trackId ? Number(fields.trackId) : null,
        personName: fields.personName || null,
        confidence: fields.confidence ? Number(fields.confidence) : null,
        snapshotKey: fields.snapshotKey || null,
        clipKey: fields.clipKey || null,
        modelVersion: fields.modelVersion || null,
      },
      include: { camera: true },
    });
    return {
      view: this.view({ ...event, camera }),
      telegramChatId: camera.store.telegramChatId,
    };
  }

  async list(dto: ListEventsDto): Promise<EventView[]> {
    await this.assertStoreOwner(dto.storeId, dto.ownerId);
    const events = await this.prisma.event.findMany({
      where: {
        camera: { storeId: dto.storeId },
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: { camera: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return events.map((e) => this.view(e as EventWithCamera));
  }

  async updateStatus(dto: UpdateEventStatusDto): Promise<EventView> {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
      include: { camera: { include: { store: true } } },
    });
    if (!event) throw new NotFoundException('Событие не найдено');
    if (event.camera.store.ownerId !== dto.ownerId) {
      throw new ForbiddenException('Нет доступа к событию');
    }
    const updated = await this.prisma.event.update({
      where: { id: dto.eventId },
      data: { status: dto.status, reviewedBy: dto.ownerId },
      include: { camera: true },
    });
    return this.view(updated as EventWithCamera);
  }

  private async assertStoreOwner(storeId: string, ownerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException('Магазин не найден');
    if (store.ownerId !== ownerId) {
      throw new ForbiddenException('Нет доступа к магазину');
    }
  }

  private view(e: EventWithCamera): EventView {
    return {
      id: e.id,
      storeId: e.camera.storeId,
      cameraId: e.cameraId,
      cameraName: e.camera.name,
      type: e.type as EventKind,
      trackId: e.trackId,
      personName: e.personName,
      confidence: e.confidence,
      snapshotKey: e.snapshotKey,
      clipKey: e.clipKey,
      modelVersion: e.modelVersion,
      status: e.status as EventStatusValue,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
