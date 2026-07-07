import { RiskScorer } from './risk-scorer';

const scorer = new RiskScorer({
  wUnreturned: 25,
  wSuspicious: 50,
  wQuickExit: 15,
  quickExitSec: 20,
  suspiciousThreshold: 50,
});

const inp = (
  productsTaken: number,
  productsReturned: number,
  suspiciousCount: number,
  durationSec: number | null = 100,
) => ({ productsTaken, productsReturned, suspiciousCount, durationSec });

describe('RiskScorer.score', () => {
  it('без сигналов → 0', () => {
    expect(scorer.score(inp(0, 0, 0))).toBe(0);
  });
  it('невозвращённые товары → вес', () => {
    expect(scorer.score(inp(2, 0, 0))).toBe(50);
  });
  it('возврат обнуляет невозвращённые', () => {
    expect(scorer.score(inp(2, 2, 0))).toBe(0);
  });
  it('подозрения → вес', () => {
    expect(scorer.score(inp(0, 0, 1))).toBe(50);
  });
  it('clamp до 100', () => {
    expect(scorer.score(inp(5, 0, 2))).toBe(100);
  });
  it('быстрый выход с товаром → бонус', () => {
    expect(scorer.score(inp(1, 0, 0, 10))).toBe(40); // 25 + 15
    expect(scorer.score(inp(1, 0, 0, 100))).toBe(25); // не быстрый
  });
});

describe('RiskScorer.behaviorType', () => {
  it('подозрение + невозврат → THEFT_SUSPECT', () => {
    const i = inp(1, 0, 1);
    expect(scorer.behaviorType(scorer.score(i), i)).toBe('THEFT_SUSPECT');
  });
  it('высокий риск без невозврата → SUSPICIOUS', () => {
    const i = inp(0, 0, 1); // score 50, unreturned 0
    expect(scorer.behaviorType(scorer.score(i), i)).toBe('SUSPICIOUS');
  });
  it('взял и вернул → SHOPPER', () => {
    const i = inp(1, 1, 0);
    expect(scorer.behaviorType(scorer.score(i), i)).toBe('SHOPPER');
  });
  it('ничего → BROWSER', () => {
    const i = inp(0, 0, 0);
    expect(scorer.behaviorType(scorer.score(i), i)).toBe('BROWSER');
  });
});
