import { Injectable } from '@nestjs/common';
import {
  Receipt,
  ReceiptProvider,
  ReceiptQuery,
} from './receipt-provider.interface';

/**
 * Тестовый провайдер чеков (без реальной POS). Детерминирован по trackingId:
 *   - нечисловой / отсутствует → null (нет чека);
 *   - n % 10 == 9 → null (покупатель без чека — потенциальная кража);
 *   - иначе чек с товарами sku-1..sku-k, где k = (n % 3) + 1.
 * Формула документирована — интеграционные тесты подстраивают AI-товары.
 */
@Injectable()
export class MockReceiptProvider implements ReceiptProvider {
  async findReceipt(query: ReceiptQuery): Promise<Receipt | null> {
    const n = Number(query.trackingId);
    if (!query.trackingId || Number.isNaN(n)) return null;
    if (n % 10 === 9) return null;

    const k = (n % 3) + 1;
    return {
      receiptId: `R-${query.trackingId}`,
      checkoutId: query.checkoutId ?? `POS-${(n % 2) + 1}`,
      products: Array.from({ length: k }, (_, i) => `sku-${i + 1}`),
      issuedAt: new Date().toISOString(),
    };
  }
}
