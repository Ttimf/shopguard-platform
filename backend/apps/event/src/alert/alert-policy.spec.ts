import { AlertPolicy } from './alert-policy';

const policy = new AlertPolicy({
  riskThreshold: 60,
  cameraOfflineSeverity: 'MEDIUM',
});

const inp = (
  purchaseStatus: 'MATCHED' | 'PARTIAL_MATCH' | 'NOT_MATCHED',
  riskScore: number,
) => ({ purchaseStatus, riskScore, confidence: 0 });

describe('AlertPolicy.decidePurchase', () => {
  it('MATCHED → без тревоги', () => {
    expect(policy.decidePurchase(inp('MATCHED', 90)).create).toBe(false);
  });

  it('NOT_MATCHED + высокий риск → THEFT_ALERT HIGH', () => {
    const v = policy.decidePurchase(inp('NOT_MATCHED', 80));
    expect(v.create).toBe(true);
    expect(v.alertType).toBe('THEFT_ALERT');
    expect(v.severity).toBe('HIGH');
    expect(v.decision).toBe('HIGH_RISK_UNPAID');
  });

  it('NOT_MATCHED + низкий риск → THEFT_ALERT MEDIUM', () => {
    const v = policy.decidePurchase(inp('NOT_MATCHED', 10));
    expect(v.severity).toBe('MEDIUM');
    expect(v.decision).toBe('UNPAID_ITEMS');
  });

  it('PARTIAL_MATCH + высокий риск → THEFT_ALERT MEDIUM', () => {
    const v = policy.decidePurchase(inp('PARTIAL_MATCH', 70));
    expect(v.alertType).toBe('THEFT_ALERT');
    expect(v.severity).toBe('MEDIUM');
  });

  it('PARTIAL_MATCH + низкий риск → SUSPICIOUS LOW', () => {
    const v = policy.decidePurchase(inp('PARTIAL_MATCH', 20));
    expect(v.alertType).toBe('SUSPICIOUS');
    expect(v.severity).toBe('LOW');
  });

  it('порог риска граничный (=60 → высокий)', () => {
    expect(policy.decidePurchase(inp('NOT_MATCHED', 60)).severity).toBe('HIGH');
  });
});
