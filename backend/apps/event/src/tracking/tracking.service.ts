import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common';
import { ListTracksDto, PersonTrackView } from '@app/contracts';
import { PersonTrackRepository } from './person-track.repository';

type TrackRow = {
  id: string;
  trackingId: string;
  storeId: string;
  cameraId: string;
  enteredAt: Date;
  exitedAt: Date | null;
  duration: number | null;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Tracking Engine: ведёт маршрут человека между камерами магазина.
 * PersonDetected → открыть/перенести сегмент; PersonExited → закрыть.
 */
@Injectable()
export class TrackingService {
  private readonly logger = new Logger('TrackingService');

  constructor(
    private readonly repo: PersonTrackRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Человек замечен на камере: открыть сегмент или перенести с другой камеры. */
  async onDetected(
    storeId: string,
    cameraId: string,
    trackingId: string,
  ): Promise<void> {
    const openHere = await this.repo.findOpenOnCamera(
      storeId,
      trackingId,
      cameraId,
    );
    if (openHere) return; // уже отслеживаем здесь

    const openElsewhere = await this.repo.findOpen(storeId, trackingId);
    if (openElsewhere) {
      // хэндофф между камерами: закрываем прошлый сегмент
      await this.closeTrack(openElsewhere as TrackRow, {
        reason: 'handoff',
        toCamera: cameraId,
      });
    }
    await this.repo.open({
      trackingId,
      storeId,
      cameraId,
      enteredAt: new Date(),
      metadata: openElsewhere
        ? { fromCamera: (openElsewhere as TrackRow).cameraId }
        : undefined,
    });
  }

  /** Человек покинул зону: закрыть открытый сегмент на этой камере. */
  async onExited(
    storeId: string,
    cameraId: string,
    trackingId: string,
  ): Promise<void> {
    const open = await this.repo.findOpenOnCamera(
      storeId,
      trackingId,
      cameraId,
    );
    if (open) await this.closeTrack(open as TrackRow, { reason: 'exit' });
  }

  private async closeTrack(track: TrackRow, meta: object): Promise<void> {
    const exitedAt = new Date();
    const duration = Math.max(
      0,
      Math.round((exitedAt.getTime() - track.enteredAt.getTime()) / 1000),
    );
    const metadata = { ...((track.metadata as object) ?? {}), ...meta };
    await this.repo.close(track.id, exitedAt, duration, metadata);
  }

  // ---- запросы (owner-scoped) ----

  async list(dto: ListTracksDto): Promise<PersonTrackView[]> {
    const storeIds = await this.ownedStoreIds(dto.ownerId, dto.storeId);
    if (storeIds.length === 0) return [];
    const rows = await this.repo.findMany({
      storeIds,
      cameraId: dto.cameraId,
      trackingId: dto.trackingId,
      active: dto.active,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: Math.min(dto.limit ?? 100, 500),
    });
    return rows.map((r) => this.view(r as TrackRow));
  }

  async get(ownerId: string, id: string): Promise<PersonTrackView> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Сегмент не найден');
    const storeIds = await this.ownedStoreIds(ownerId);
    if (!storeIds.includes(row.storeId)) {
      throw new ForbiddenException('Нет доступа к сегменту');
    }
    return this.view(row as TrackRow);
  }

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

  private view(t: TrackRow): PersonTrackView {
    return {
      id: t.id,
      trackingId: t.trackingId,
      storeId: t.storeId,
      cameraId: t.cameraId,
      enteredAt: t.enteredAt.toISOString(),
      exitedAt: t.exitedAt ? t.exitedAt.toISOString() : null,
      duration: t.duration,
      active: t.exitedAt === null,
      metadata: (t.metadata as Record<string, unknown>) ?? null,
      createdAt: t.createdAt.toISOString(),
    };
  }
}
