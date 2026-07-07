import { PurchaseService } from './purchase.service';
import { PurchaseMatcher } from './purchase-matcher';

describe('PurchaseService.onExited', () => {
  let repo: any;
  let prisma: any;
  let bus: any;
  let receipts: any;
  let service: PurchaseService;

  const takenEvents = (products: string[]) =>
    products.map((p) => ({ metadata: { product: p } }));

  beforeEach(() => {
    repo = { create: jest.fn(), findById: jest.fn(), findMany: jest.fn() };
    prisma = {
      eventLog: { findMany: jest.fn() },
      store: { findMany: jest.fn() },
    };
    bus = { publish: jest.fn() };
    receipts = { findReceipt: jest.fn() };
    service = new PurchaseService(
      repo,
      prisma,
      new PurchaseMatcher(),
      bus,
      receipts,
    );
  });

  it('всё совпало → MATCHED, без PurchaseMismatch', async () => {
    prisma.eventLog.findMany.mockResolvedValue(takenEvents(['a', 'b']));
    receipts.findReceipt.mockResolvedValue({
      receiptId: 'R1', checkoutId: 'POS1', products: ['a', 'b'],
    });
    await service.onExited('s1', '7');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'MATCHED', confidence: 100, receiptId: 'R1' }),
    );
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('часть не оплачена → PARTIAL_MATCH + публикует PurchaseMismatch', async () => {
    prisma.eventLog.findMany.mockResolvedValue(takenEvents(['a', 'b']));
    receipts.findReceipt.mockResolvedValue({
      receiptId: 'R1', checkoutId: 'POS1', products: ['a'],
    });
    await service.onExited('s1', '7');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PARTIAL_MATCH', missingProducts: ['b'] }),
    );
    expect(bus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'PurchaseMismatch' }),
    );
  });

  it('нет товаров и нет чека → ничего не создаёт', async () => {
    prisma.eventLog.findMany.mockResolvedValue([]);
    receipts.findReceipt.mockResolvedValue(null);
    await service.onExited('s1', '7');
    expect(repo.create).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('взял, но чека нет → NOT_MATCHED + PurchaseMismatch', async () => {
    prisma.eventLog.findMany.mockResolvedValue(takenEvents(['a', 'b']));
    receipts.findReceipt.mockResolvedValue(null);
    await service.onExited('s1', '7');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'NOT_MATCHED' }),
    );
    expect(bus.publish).toHaveBeenCalled();
  });
});
