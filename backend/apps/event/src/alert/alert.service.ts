import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService, EventBus } from '@app/common';
import {
  AlertDecisionView,
  AlertSeverity,
  EngineEvent,
  EngineEventType,
  ListAlertsDto,
  PurchaseStatus,
} from '@app/contracts';
import { AlertDecisionRepository } from './alert-decision.repository';
import { AlertPolicy } from './alert-policy';

type AlertRow = {
  id: string;
  trackingId: string | null;
  storeId: string;
  alertType: string;
  severity: string;
  decision: string;
  riskScore: number | null;
  confidence: number | null;
  behaviorSessionId: string | null;
  purchaseSessionId: string | null;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Alert Engine: объединяет риск (Behavior) и результат сопоставления (Purchase),
 * принимает решение и создаёт AlertDecision. Уведомления не шлёт — только
 * публикует AlertCreated (event-driven; доставку делает notification-service).
 */
@Injectable()
export class AlertService {
  constructor(
    private readonly repo: AlertDecisionRepository,
    private readonly prisma: PrismaService,
    @Inject(AlertPolicy) private readonly policy: AlertPolicy,
    private readonly bus: EventBus,
  ) {}

  /** Несовпадение покупки → соотнести с риском поведения и решить. */
  async onPurchaseMismatch(e: EngineEvent): Promise<void> {
    const tid = e.trackingId != null ? String(e.trackingId) : null;
    if (!tid) return;

    const [behavior, purchase] = await Promise.all([
      this.prisma.behaviorSession.findFirst({
        where: { storeId: e.storeId, trackingId: tid },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.purchaseSession.findFirst({
        where: { storeId: e.storeId, trackingId: tid },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const meta = (e.metadata as Record<string, unknown>) ?? {};
    const purchaseStatus = (purchase?.status ??
      meta.status ??
      'NOT_MATCHED') as PurchaseStatus;
    const riskScore = behavior?.riskScore ?? 0;
    const confidence = purchase?.confidence ?? Number(e.confidence ?? 0);

    const verdict = this.policy.decidePurchase({
      purchaseStatus,
      confidence,
      riskScore,
    });
    if (!verdict.create) return;

    const alert = (await this.repo.create({
      trackingId: tid,
      storeId: e.storeId,
      alertType: verdict.alertType,
      severity: verdict.severity,
      decision: verdict.decision,
      riskScore,
      confidence,
      behaviorSessionId: behavior?.id ?? null,
      purchaseSessionId: purchase?.id ?? null,
      metadata: { purchaseStatus, missing: meta.missing ?? [] },
    })) as AlertRow;

    await this.publishCreated(alert);
  }

  /** Камера офлайн → тревога о «слепой зоне». */
  async onCameraOffline(e: EngineEvent): Promise<void> {
    const alert = (await this.repo.create({
      trackingId: null,
      storeId: e.storeId,
      alertType: 'CAMERA_OFFLINE',
      severity: this.policy.cameraOfflineSeverity,
      decision: 'CAMERA_OFFLINE',
      riskScore: null,
      confidence: null,
      behaviorSessionId: null,
      purchaseSessionId: null,
      metadata: { cameraId: e.cameraId ?? null },
    })) as AlertRow;
    await this.publishCreated(alert);
  }

  private async publishCreated(alert: AlertRow): Promise<void> {
    const tidNum = alert.trackingId != null ? Number(alert.trackingId) : null;
    await this.bus.publish({
      eventId: randomUUID(),
      storeId: alert.storeId,
      trackingId: tidNum != null && !Number.isNaN(tidNum) ? tidNum : null,
      eventType: EngineEventType.ALERT_CREATED,
      timestamp: new Date().toISOString(),
      metadata: {
        alertId: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        decision: alert.decision,
      },
    });
  }

  // ---- запросы (owner-scoped) ----

  async list(dto: ListAlertsDto): Promise<AlertDecisionView[]> {
    const storeIds = await this.ownedStoreIds(dto.ownerId, dto.storeId);
    if (storeIds.length === 0) return [];
    const rows = await this.repo.findMany({
      storeIds,
      severity: dto.severity,
      alertType: dto.alertType,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: Math.min(dto.limit ?? 100, 500),
    });
    return rows.map((r) => this.view(r as AlertRow));
  }

  async get(ownerId: string, id: string): Promise<AlertDecisionView> {
    const row = (await this.repo.findById(id)) as AlertRow | null;
    if (!row) throw new NotFoundException('Тревога не найдена');
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

  private view(a: AlertRow): AlertDecisionView {
    return {
      id: a.id,
      trackingId: a.trackingId,
      storeId: a.storeId,
      alertType: a.alertType,
      severity: a.severity as AlertSeverity,
      decision: a.decision,
      riskScore: a.riskScore,
      confidence: a.confidence,
      behaviorSessionId: a.behaviorSessionId,
      purchaseSessionId: a.purchaseSessionId,
      metadata: (a.metadata as Record<string, unknown>) ?? null,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
