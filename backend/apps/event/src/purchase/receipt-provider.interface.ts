/** Универсальный интерфейс поставщика чеков (POS-агностичный). */
export const RECEIPT_PROVIDER = 'RECEIPT_PROVIDER';

export interface ReceiptQuery {
  storeId: string;
  trackingId?: string;
  checkoutId?: string;
  from: Date; // окно визита
  to: Date;
}

export interface Receipt {
  receiptId: string;
  checkoutId: string;
  products: string[]; // артикулы/наименования
  issuedAt: string; // ISO
}

/**
 * Реализация под конкретную POS (REGO и т.п.) подставляется через DI-токен
 * RECEIPT_PROVIDER — движок от POS не зависит.
 */
export interface ReceiptProvider {
  findReceipt(query: ReceiptQuery): Promise<Receipt | null>;
}
