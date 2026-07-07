import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';

export interface BehaviorFilter {
  storeIds: string[];
  behaviorType?: string;
  minRiskScore?: number;
  maxRiskScore?: number;
  active?: boolean;
  from?: Date;
  to?: Date;
  limit: number;
}

/** Доступ к таблице BehaviorSession. */
@Injectable()
export class BehaviorSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOpen(storeId: string, trackingId: string) {
    return this.prisma.behaviorSession.findFirst({
      where: { storeId, trackingId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  open(data: {
    storeId: string;
    trackingId: string;
    startedAt: Date;
    visitedCameras: string[];
    metadata: object;
  }) {
    return this.prisma.behaviorSession.create({
      data: {
        storeId: data.storeId,
        trackingId: data.trackingId,
        startedAt: data.startedAt,
        visitedCameras: data.visitedCameras,
        metadata: data.metadata,
      },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.behaviorSession.update({ where: { id }, data });
  }

  findById(id: string) {
    return this.prisma.behaviorSession.findUnique({ where: { id } });
  }

  findMany(f: BehaviorFilter) {
    return this.prisma.behaviorSession.findMany({
      where: {
        storeId: { in: f.storeIds },
        ...(f.behaviorType ? { behaviorType: f.behaviorType } : {}),
        ...(f.active !== undefined
          ? { endedAt: f.active ? null : { not: null } }
          : {}),
        ...(f.minRiskScore !== undefined || f.maxRiskScore !== undefined
          ? {
              riskScore: {
                ...(f.minRiskScore !== undefined ? { gte: f.minRiskScore } : {}),
                ...(f.maxRiskScore !== undefined ? { lte: f.maxRiskScore } : {}),
              },
            }
          : {}),
        ...(f.from || f.to
          ? {
              startedAt: {
                ...(f.from ? { gte: f.from } : {}),
                ...(f.to ? { lte: f.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: f.limit,
    });
  }
}
