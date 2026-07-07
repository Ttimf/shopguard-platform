import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';

export interface OpenTrackData {
  trackingId: string;
  storeId: string;
  cameraId: string;
  enteredAt: Date;
  metadata?: object;
}

export interface TrackFilter {
  storeIds: string[];
  cameraId?: string;
  trackingId?: string;
  active?: boolean;
  from?: Date;
  to?: Date;
  limit: number;
}

/** Доступ к таблице PersonTrack (сегменты присутствия). */
@Injectable()
export class PersonTrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  open(data: OpenTrackData) {
    return this.prisma.personTrack.create({
      data: {
        trackingId: data.trackingId,
        storeId: data.storeId,
        cameraId: data.cameraId,
        enteredAt: data.enteredAt,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  /** Открытый сегмент трека в магазине (на любой камере), самый свежий. */
  findOpen(storeId: string, trackingId: string) {
    return this.prisma.personTrack.findFirst({
      where: { storeId, trackingId, exitedAt: null },
      orderBy: { enteredAt: 'desc' },
    });
  }

  findOpenOnCamera(storeId: string, trackingId: string, cameraId: string) {
    return this.prisma.personTrack.findFirst({
      where: { storeId, trackingId, cameraId, exitedAt: null },
      orderBy: { enteredAt: 'desc' },
    });
  }

  close(id: string, exitedAt: Date, duration: number, metadata?: object) {
    return this.prisma.personTrack.update({
      where: { id },
      data: { exitedAt, duration, ...(metadata ? { metadata } : {}) },
    });
  }

  findById(id: string) {
    return this.prisma.personTrack.findUnique({ where: { id } });
  }

  findMany(f: TrackFilter) {
    return this.prisma.personTrack.findMany({
      where: {
        storeId: { in: f.storeIds },
        ...(f.cameraId ? { cameraId: f.cameraId } : {}),
        ...(f.trackingId ? { trackingId: f.trackingId } : {}),
        ...(f.active !== undefined
          ? { exitedAt: f.active ? null : { not: null } }
          : {}),
        ...(f.from || f.to
          ? {
              enteredAt: {
                ...(f.from ? { gte: f.from } : {}),
                ...(f.to ? { lte: f.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { enteredAt: 'desc' },
      take: f.limit,
    });
  }
}
