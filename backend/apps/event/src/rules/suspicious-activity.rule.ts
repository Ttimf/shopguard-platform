import { randomUUID } from 'crypto';
import { EngineEvent, EngineEventType } from '@app/contracts';
import { EventRule, RuleContext } from './rule.interface';

/**
 * Правило: человек взял товар (ProductTaken) и не вернул (ProductReturned),
 * затем покинул зону (PersonExited) → порождает SuspiciousActivity.
 * Состояние — по (storeId:trackingId); TTL защищает от утечки по «висящим» трекам.
 */
export class SuspiciousActivityRule implements EventRule {
  readonly name = 'suspicious-activity';
  private readonly taken = new Map<string, number>(); // key -> unix ms
  private readonly ttlMs = 10 * 60 * 1000;

  async handle(event: EngineEvent, ctx: RuleContext): Promise<void> {
    if (event.trackingId == null) return;
    const key = `${event.storeId}:${event.trackingId}`;
    this.prune();

    switch (event.eventType) {
      case EngineEventType.PRODUCT_TAKEN:
        this.taken.set(key, Date.now());
        break;
      case EngineEventType.PRODUCT_RETURNED:
        this.taken.delete(key);
        break;
      case EngineEventType.PERSON_EXITED:
        if (this.taken.delete(key)) {
          await ctx.emit({
            eventId: randomUUID(),
            storeId: event.storeId,
            cameraId: event.cameraId ?? null,
            trackingId: event.trackingId,
            eventType: EngineEventType.SUSPICIOUS_ACTIVITY,
            timestamp: new Date().toISOString(),
            confidence: event.confidence ?? null,
            modelVersion: event.modelVersion ?? null,
            metadata: { derivedFrom: 'ProductTaken+PersonExited' },
          });
        }
        break;
    }
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, ts] of this.taken) {
      if (now - ts > this.ttlMs) this.taken.delete(key);
    }
  }
}
