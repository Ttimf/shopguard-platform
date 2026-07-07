import { PurchaseStatus } from '@app/contracts';

export interface MatchResult {
  status: PurchaseStatus;
  confidence: number; // 0..100
  matched: string[];
  missing: string[]; // в AI, нет в чеке
  extra: string[]; // в чеке, нет в AI
}

function multiset(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return m;
}

/**
 * Сопоставление списков товаров как мультимножеств (по наименованию/артикулу).
 * MATCHED — полное совпадение; PARTIAL_MATCH — часть совпала; NOT_MATCHED — нет пересечений.
 * confidence — коэффициент Дайса (2·совпало / (|AI|+|чек|)).
 */
export class PurchaseMatcher {
  match(aiProducts: string[], receiptProducts: string[]): MatchResult {
    const ai = multiset(aiProducts);
    const receipt = multiset(receiptProducts);
    const matched: string[] = [];
    const missing: string[] = [];
    const extra: string[] = [];

    for (const [p, c] of ai) {
      const m = Math.min(c, receipt.get(p) ?? 0);
      for (let i = 0; i < m; i++) matched.push(p);
      for (let i = 0; i < c - m; i++) missing.push(p);
    }
    for (const [p, c] of receipt) {
      const m = Math.min(c, ai.get(p) ?? 0);
      for (let i = 0; i < c - m; i++) extra.push(p);
    }

    const total = aiProducts.length + receiptProducts.length;
    const confidence =
      total > 0 ? Math.round((2 * matched.length) / total * 100) : 0;

    let status: PurchaseStatus;
    if (matched.length > 0 && missing.length === 0 && extra.length === 0) {
      status = 'MATCHED';
    } else if (matched.length > 0) {
      status = 'PARTIAL_MATCH';
    } else {
      status = 'NOT_MATCHED';
    }
    return { status, confidence, matched, missing, extra };
  }
}
