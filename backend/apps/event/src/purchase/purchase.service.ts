import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService, EventBus } from '@app/common';
import {
  EngineEventType,
  ListPurchasesDto,
  PurchaseSessionView,
  PurchaseStatus,
} from '@app/contracts';
import { PurchaseSessionRepository } from './purchase-session.repository';
import { PurchaseMatcher } from './purchase-matcher';
import {
  RECEIPT_PROVIDER,
  ReceiptProvider,
} from './receipt-provider.interface';

const WINDOW_MS =
  Number(process.env.PURCHASE_WINDOW_MINUTES ?? 60) * 60 * 1000;

type PurchaseRow = {
  id: string;
  trackingId: string | null;
  storeId: string;
  checkoutId: string | null;
  receiptId: string | null;
  status: string;
  confidence: number;
  aiProducts: unknown;
  receiptProducts: unknown;
  missingProducts: unknown;
  extraProducts: unknown;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Purchase Matching Engine: при выходе человека собирает его AI-товары,
 * запрашivает чек у ReceiptProvider (POS-агностично) и сопоставляет.
 */
@Injectable()
export class PurchaseService {
  constructor(
    private readonly repo: PurchaseSessionRepository,
    private readonly prisma: PrismaService,
    private readonly matcher: PurchaseMatcher,
    private readonly bus: EventBus,
    @Inject(RECEIPT_PROVIDER) private readonly receipts: ReceiptProvider,
  ) {}

  /** Триггер по PersonExited: сопоставить корзину AI с чеком. */
  async onExited(storeId: string, trackingId: string): Promise<void> {
    const to = new Date();
    const from = new Date(to.getTime() - WINDOW_MS);
    const aiProducts = await this.collectAiProducts(storeId, trackingId, from);
    const receipt = await this.receipts.findReceipt({
      storeId,
      trackingId,
      from,
      to,
    });

    // ничего не взял и нет чека — нечего сопоставлять
    if (aiProducts.length === 0 && !receipt) return;

    const result = this.matcher.match(aiProducts, receipt?.products ?? []);
    await this.repo.create({
      trackingId,
      storeId,
      checkoutId: receipt?.checkoutId ?? null,
      receiptId: receipt?.receiptId ?? null,
      status: result.status,
      confidence: result.confidence,
      aiProducts,
      receiptProducts: receipt?.products ?? [],
      missingProducts: result.missing,
      extraProducts: result.extra,
      metadata: { hasReceipt: !!receipt },
    });

    if (result.status !== 'MATCHED') {
      const tidNum = Number(trackingId);
      await this.bus.publish({
        eventId: randomUUID(),
        storeId,
        trackingId: Number.isNaN(tidNum) ? null : tidNum,
        eventType: EngineEventType.PURCHASE_MISMATCH,
        timestamp: new Date().toISOString(),
        confidence: result.confidence,
        metadata: {
          status: result.status,
          missing: result.missing,
          extra: result.extra,
          receiptId: receipt?.receiptId ?? null,
        },
      });
    }
  }

  private async collectAiProducts(
    storeId: string,
    trackingId: string,
    from: Date,
  ): Promise<string[]> {
    const tid = Number(trackingId);
    if (Number.isNaN(tid)) return []; // EventLog.trackingId числовой (из ByteTrack)
    const events = await this.prisma.eventLog.findMany({
      where: {
        storeId,
        trackingId: tid,
        eventType: EngineEventType.PRODUCT_TAKEN,
        timestamp: { gte: from },
      },
      orderBy: { timestamp: 'asc' },
    });
    return events.map(
      (e) => ((e.metadata as any)?.product as string) ?? 'item',
    );
  }

  // ---- запросы (owner-scoped) ----

  async list(dto: ListPurchasesDto): Promise<PurchaseSessionView[]> {
    const storeIds = await this.ownedStoreIds(dto.ownerId, dto.storeId);
    if (storeIds.length === 0) return [];
    const rows = await this.repo.findMany({
      storeIds,
      checkoutId: dto.checkoutId,
      status: dto.status,
      minConfidence: dto.minConfidence,
      maxConfidence: dto.maxConfidence,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: Math.min(dto.limit ?? 100, 500),
    });
    return rows.map((r) => this.view(r as PurchaseRow));
  }

  async get(ownerId: string, id: string): Promise<PurchaseSessionView> {
    const row = (await this.repo.findById(id)) as PurchaseRow | null;
    if (!row) throw new NotFoundException('Сопоставление не найдено');
    const storeIds = await this.ownedStoreIds(ownerId);
    if (!storeIds.includes(row.storeId)) {
      throw new ForbiddenException('Нет доступа');
    }
    return this.view(row);
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

  private arr(v: unknown): string[] {
    return Array.isArray(v) ? (v as string[]) : [];
  }

  private view(p: PurchaseRow): PurchaseSessionView {
    return {
      id: p.id,
      trackingId: p.trackingId,
      storeId: p.storeId,
      checkoutId: p.checkoutId,
      receiptId: p.receiptId,
      status: p.status as PurchaseStatus,
      confidence: p.confidence,
      aiProducts: this.arr(p.aiProducts),
      receiptProducts: this.arr(p.receiptProducts),
      missingProducts: this.arr(p.missingProducts),
      extraProducts: this.arr(p.extraProducts),
      metadata: (p.metadata as Record<string, unknown>) ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
