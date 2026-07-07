import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common';
import {
  BehaviorSessionView,
  BehaviorType,
  ListBehaviorDto,
} from '@app/contracts';
import { BehaviorSessionRepository } from './behavior-session.repository';
import { RiskInput, RiskScorer } from './risk-scorer';

type SessionRow = {
  id: string;
  trackingId: string;
  storeId: string;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null;
  visitedCameras: unknown;
  productsTaken: number;
  productsReturned: number;
  riskScore: number;
  behaviorType: string;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Behavior Engine: собирает сессию визита (камеры/товары/подозрения),
 * считает riskScore по настраиваемым правилам, закрывает на PersonExited.
 */
@Injectable()
export class BehaviorService {
  constructor(
    private readonly repo: BehaviorSessionRepository,
    private readonly prisma: PrismaService,
    @Inject(RiskScorer) private readonly scorer: RiskScorer,
  ) {}

  async onDetected(storeId: string, trackingId: string, cameraId?: string) {
    const s = await this.ensure(storeId, trackingId, cameraId);
    const cameras = this.cameras(s);
    if (cameraId && !cameras.includes(cameraId)) {
      cameras.push(cameraId);
      await this.persist(s, { visitedCameras: cameras });
    }
  }

  async onProductTaken(storeId: string, trackingId: string) {
    const s = await this.ensure(storeId, trackingId);
    await this.persist(s, { productsTaken: s.productsTaken + 1 });
  }

  async onProductReturned(storeId: string, trackingId: string) {
    const s = await this.ensure(storeId, trackingId);
    await this.persist(s, { productsReturned: s.productsReturned + 1 });
  }

  async onSuspicious(storeId: string, trackingId: string) {
    const s = await this.ensure(storeId, trackingId);
    const meta = this.meta(s);
    meta.suspiciousCount = (Number(meta.suspiciousCount) || 0) + 1;
    await this.persist(s, { metadata: meta });
  }

  /** Завершение маршрута → закрыть сессию с финальным risk score. */
  async onExited(storeId: string, trackingId: string) {
    const s = (await this.repo.findOpen(storeId, trackingId)) as SessionRow | null;
    if (!s) return;
    const endedAt = new Date();
    const duration = this.elapsed(s, endedAt);
    const input = this.input(s, duration);
    const riskScore = this.scorer.score(input);
    const behaviorType = this.scorer.behaviorType(riskScore, input);
    await this.repo.update(s.id, {
      endedAt,
      duration,
      riskScore,
      behaviorType,
    });
  }

  // ---- внутреннее ----

  private async ensure(
    storeId: string,
    trackingId: string,
    cameraId?: string,
  ): Promise<SessionRow> {
    const open = (await this.repo.findOpen(storeId, trackingId)) as
      | SessionRow
      | null;
    if (open) return open;
    return (await this.repo.open({
      storeId,
      trackingId,
      startedAt: new Date(),
      visitedCameras: cameraId ? [cameraId] : [],
      metadata: { suspiciousCount: 0 },
    })) as SessionRow;
  }

  /** Применяет изменения + пересчитывает live risk и тип. */
  private async persist(
    s: SessionRow,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const merged = { ...s, ...changes } as SessionRow;
    const input = this.input(merged, this.elapsed(merged, new Date()));
    const riskScore = this.scorer.score(input);
    const behaviorType = this.scorer.behaviorType(riskScore, input);
    await this.repo.update(s.id, { ...changes, riskScore, behaviorType });
  }

  private input(s: SessionRow, durationSec: number | null): RiskInput {
    return {
      productsTaken: s.productsTaken,
      productsReturned: s.productsReturned,
      suspiciousCount: Number(this.meta(s).suspiciousCount) || 0,
      durationSec,
    };
  }

  private elapsed(s: SessionRow, at: Date): number {
    return Math.max(0, Math.round((at.getTime() - s.startedAt.getTime()) / 1000));
  }

  private cameras(s: SessionRow): string[] {
    return Array.isArray(s.visitedCameras) ? [...(s.visitedCameras as string[])] : [];
  }

  private meta(s: SessionRow): Record<string, unknown> {
    return { ...((s.metadata as Record<string, unknown>) ?? {}) };
  }

  // ---- запросы (owner-scoped) ----

  async list(dto: ListBehaviorDto): Promise<BehaviorSessionView[]> {
    const storeIds = await this.ownedStoreIds(dto.ownerId, dto.storeId);
    if (storeIds.length === 0) return [];
    const rows = await this.repo.findMany({
      storeIds,
      behaviorType: dto.behaviorType,
      minRiskScore: dto.minRiskScore,
      maxRiskScore: dto.maxRiskScore,
      active: dto.active,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: Math.min(dto.limit ?? 100, 500),
    });
    return rows.map((r) => this.view(r as SessionRow));
  }

  async get(ownerId: string, id: string): Promise<BehaviorSessionView> {
    const row = (await this.repo.findById(id)) as SessionRow | null;
    if (!row) throw new NotFoundException('Сессия не найдена');
    const storeIds = await this.ownedStoreIds(ownerId);
    if (!storeIds.includes(row.storeId)) {
      throw new ForbiddenException('Нет доступа к сессии');
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

  private view(s: SessionRow): BehaviorSessionView {
    return {
      id: s.id,
      trackingId: s.trackingId,
      storeId: s.storeId,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt ? s.endedAt.toISOString() : null,
      duration: s.duration,
      active: s.endedAt === null,
      visitedCameras: this.cameras(s),
      productsTaken: s.productsTaken,
      productsReturned: s.productsReturned,
      riskScore: s.riskScore,
      behaviorType: s.behaviorType as BehaviorType,
      metadata: (s.metadata as Record<string, unknown>) ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
