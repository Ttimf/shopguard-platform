import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { PurchaseStatus } from '@app/contracts';

export interface CreatePurchaseData {
  trackingId: string | null;
  storeId: string;
  checkoutId: string | null;
  receiptId: string | null;
  status: PurchaseStatus;
  confidence: number;
  aiProducts: string[];
  receiptProducts: string[];
  missingProducts: string[];
  extraProducts: string[];
  metadata?: object;
}

export interface PurchaseFilter {
  storeIds: string[];
  checkoutId?: string;
  status?: string;
  minConfidence?: number;
  maxConfidence?: number;
  from?: Date;
  to?: Date;
  limit: number;
}

@Injectable()
export class PurchaseSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreatePurchaseData) {
    return this.prisma.purchaseSession.create({
      data: {
        trackingId: data.trackingId,
        storeId: data.storeId,
        checkoutId: data.checkoutId,
        receiptId: data.receiptId,
        status: data.status,
        confidence: data.confidence,
        aiProducts: data.aiProducts,
        receiptProducts: data.receiptProducts,
        missingProducts: data.missingProducts,
        extraProducts: data.extraProducts,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  findById(id: string) {
    return this.prisma.purchaseSession.findUnique({ where: { id } });
  }

  findMany(f: PurchaseFilter) {
    return this.prisma.purchaseSession.findMany({
      where: {
        storeId: { in: f.storeIds },
        ...(f.checkoutId ? { checkoutId: f.checkoutId } : {}),
        ...(f.status ? { status: f.status } : {}),
        ...(f.minConfidence !== undefined || f.maxConfidence !== undefined
          ? {
              confidence: {
                ...(f.minConfidence !== undefined ? { gte: f.minConfidence } : {}),
                ...(f.maxConfidence !== undefined ? { lte: f.maxConfidence } : {}),
              },
            }
          : {}),
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
