import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { AlertSeverity } from '@app/contracts';

export interface CreateAlertData {
  trackingId: string | null;
  storeId: string;
  alertType: string;
  severity: AlertSeverity;
  decision: string;
  riskScore: number | null;
  confidence: number | null;
  behaviorSessionId: string | null;
  purchaseSessionId: string | null;
  metadata?: object;
}

export interface AlertFilter {
  storeIds: string[];
  severity?: string;
  alertType?: string;
  from?: Date;
  to?: Date;
  limit: number;
}

@Injectable()
export class AlertDecisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateAlertData) {
    return this.prisma.alertDecision.create({
      data: {
        trackingId: data.trackingId,
        storeId: data.storeId,
        alertType: data.alertType,
        severity: data.severity,
        decision: data.decision,
        riskScore: data.riskScore,
        confidence: data.confidence,
        behaviorSessionId: data.behaviorSessionId,
        purchaseSessionId: data.purchaseSessionId,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  findById(id: string) {
    return this.prisma.alertDecision.findUnique({ where: { id } });
  }

  findMany(f: AlertFilter) {
    return this.prisma.alertDecision.findMany({
      where: {
        storeId: { in: f.storeIds },
        ...(f.severity ? { severity: f.severity } : {}),
        ...(f.alertType ? { alertType: f.alertType } : {}),
        ...(f.from || f.to
          ? {
              createdAt: {
                ...(f.from ? { gte: f.from } : {}),
                ...(f.to ? { lte: f.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: f.limit,
    });
  }
}
