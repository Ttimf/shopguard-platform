import { AlertSeverity, PurchaseStatus } from '@app/contracts';

export interface AlertInput {
  purchaseStatus: PurchaseStatus;
  confidence: number;
  riskScore: number;
}

export interface AlertVerdict {
  create: boolean;
  alertType: string;
  severity: AlertSeverity;
  decision: string; // код причины
}

export interface AlertConfig {
  riskThreshold: number; // порог «высокого» риска
  cameraOfflineSeverity: AlertSeverity;
}

/**
 * Политика принятия решения о тревоге (пороги конфигурируемы через ENV).
 *   - высокий риск + (NOT_MATCHED | PARTIAL_MATCH) → THEFT_ALERT;
 *   - низкий риск + MATCHED → без тревоги.
 * Чистая логика — покрыта unit-тестами.
 */
export class AlertPolicy {
  constructor(private readonly cfg: AlertConfig) {}

  static fromEnv(): AlertPolicy {
    return new AlertPolicy({
      riskThreshold: Number(process.env.ALERT_RISK_THRESHOLD ?? 60),
      cameraOfflineSeverity:
        (process.env.ALERT_CAMERA_OFFLINE_SEVERITY as AlertSeverity) ?? 'MEDIUM',
    });
  }

  get cameraOfflineSeverity(): AlertSeverity {
    return this.cfg.cameraOfflineSeverity;
  }

  /** Решение по результату сопоставления покупки + риску поведения. */
  decidePurchase(i: AlertInput): AlertVerdict {
    const riskHigh = i.riskScore >= this.cfg.riskThreshold;

    if (i.purchaseStatus === 'MATCHED') {
      return { create: false, alertType: '', severity: 'LOW', decision: 'MATCHED_NO_ALERT' };
    }
    if (i.purchaseStatus === 'NOT_MATCHED') {
      return {
        create: true,
        alertType: 'THEFT_ALERT',
        severity: riskHigh ? 'HIGH' : 'MEDIUM',
        decision: riskHigh ? 'HIGH_RISK_UNPAID' : 'UNPAID_ITEMS',
      };
    }
    // PARTIAL_MATCH
    if (riskHigh) {
      return { create: true, alertType: 'THEFT_ALERT', severity: 'MEDIUM', decision: 'HIGH_RISK_PARTIAL' };
    }
    return { create: true, alertType: 'SUSPICIOUS', severity: 'LOW', decision: 'PARTIAL_LOW_RISK' };
  }
}
