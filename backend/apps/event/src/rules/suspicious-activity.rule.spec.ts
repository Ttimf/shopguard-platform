import { EngineEvent, EngineEventType } from '@app/contracts';
import { SuspiciousActivityRule } from './suspicious-activity.rule';

const ev = (
  eventType: EngineEventType,
  trackingId: number | null,
  storeId = 's1',
): EngineEvent => ({
  eventId: 'e',
  storeId,
  cameraId: 'c1',
  trackingId,
  eventType,
  timestamp: new Date().toISOString(),
});

describe('SuspiciousActivityRule', () => {
  let rule: SuspiciousActivityRule;
  let emitted: EngineEvent[];
  const ctx = { emit: async (e: EngineEvent) => void emitted.push(e) };

  beforeEach(() => {
    rule = new SuspiciousActivityRule();
    emitted = [];
  });

  it('ProductTaken затем PersonExited → SuspiciousActivity', async () => {
    await rule.handle(ev(EngineEventType.PRODUCT_TAKEN, 1), ctx);
    await rule.handle(ev(EngineEventType.PERSON_EXITED, 1), ctx);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].eventType).toBe(EngineEventType.SUSPICIOUS_ACTIVITY);
    expect(emitted[0].trackingId).toBe(1);
  });

  it('PersonExited без ProductTaken → ничего', async () => {
    await rule.handle(ev(EngineEventType.PERSON_EXITED, 2), ctx);
    expect(emitted).toHaveLength(0);
  });

  it('ProductReturned отменяет подозрение', async () => {
    await rule.handle(ev(EngineEventType.PRODUCT_TAKEN, 3), ctx);
    await rule.handle(ev(EngineEventType.PRODUCT_RETURNED, 3), ctx);
    await rule.handle(ev(EngineEventType.PERSON_EXITED, 3), ctx);
    expect(emitted).toHaveLength(0);
  });

  it('состояние изолировано по треку', async () => {
    await rule.handle(ev(EngineEventType.PRODUCT_TAKEN, 1), ctx);
    await rule.handle(ev(EngineEventType.PERSON_EXITED, 2), ctx); // другой трек
    expect(emitted).toHaveLength(0);
  });

  it('без trackingId игнорируется', async () => {
    await rule.handle(ev(EngineEventType.PRODUCT_TAKEN, null), ctx);
    await rule.handle(ev(EngineEventType.PERSON_EXITED, null), ctx);
    expect(emitted).toHaveLength(0);
  });
});
