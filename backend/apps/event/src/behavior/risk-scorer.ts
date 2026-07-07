import { BehaviorType } from '@app/contracts';

export interface RiskInput {
  productsTaken: number;
  productsReturned: number;
  suspiciousCount: number;
  durationSec: number | null;
}

export interface RiskConfig {
  wUnreturned: number; // вес за каждый невозвращённый товар
  wSuspicious: number; // вес за каждое SuspiciousActivity
  wQuickExit: number; // бонус: быстрый выход с невозвращённым товаром
  quickExitSec: number;
  suspiciousThreshold: number; // порог типа SUSPICIOUS
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Риск-скоринг сессии по настраиваемым правилам (веса из окружения).
 * Чистая логика — покрыта unit-тестами.
 */
export class RiskScorer {
  constructor(private readonly cfg: RiskConfig) {}

  static fromEnv(): RiskScorer {
    const num = (name: string, def: number) =>
      Number(process.env[name] ?? def);
    return new RiskScorer({
      wUnreturned: num('BEHAVIOR_W_UNRETURNED', 25),
      wSuspicious: num('BEHAVIOR_W_SUSPICIOUS', 50),
      wQuickExit: num('BEHAVIOR_W_QUICK_EXIT', 15),
      quickExitSec: num('BEHAVIOR_QUICK_EXIT_SEC', 20),
      suspiciousThreshold: num('BEHAVIOR_SUSPICIOUS_THRESHOLD', 50),
    });
  }

  private unreturned(i: RiskInput): number {
    return Math.max(0, i.productsTaken - i.productsReturned);
  }

  score(i: RiskInput): number {
    const unreturned = this.unreturned(i);
    let s = unreturned * this.cfg.wUnreturned + i.suspiciousCount * this.cfg.wSuspicious;
    if (
      unreturned > 0 &&
      i.durationSec != null &&
      i.durationSec < this.cfg.quickExitSec
    ) {
      s += this.cfg.wQuickExit; // быстро взял и ушёл
    }
    return clamp(s);
  }

  behaviorType(score: number, i: RiskInput): BehaviorType {
    if (i.suspiciousCount > 0 && this.unreturned(i) > 0) return 'THEFT_SUSPECT';
    if (score >= this.cfg.suspiciousThreshold) return 'SUSPICIOUS';
    if (i.productsTaken > 0) return 'SHOPPER';
    return 'BROWSER';
  }
}
