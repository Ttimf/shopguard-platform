import { BehaviorService } from './behavior.service';
import { RiskScorer } from './risk-scorer';

const scorer = new RiskScorer({
  wUnreturned: 25,
  wSuspicious: 50,
  wQuickExit: 15,
  quickExitSec: 20,
  suspiciousThreshold: 50,
});

const session = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  trackingId: '7',
  storeId: 's1',
  startedAt: new Date(Date.now() - 30000),
  endedAt: null,
  duration: null,
  visitedCameras: ['camA'],
  productsTaken: 0,
  productsReturned: 0,
  riskScore: 0,
  behaviorType: 'BROWSER',
  metadata: { suspiciousCount: 0 },
  createdAt: new Date(),
  ...over,
});

describe('BehaviorService', () => {
  let repo: any;
  let prisma: any;
  let service: BehaviorService;

  beforeEach(() => {
    repo = {
      findOpen: jest.fn(),
      open: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
    };
    prisma = { store: { findMany: jest.fn() } };
    service = new BehaviorService(repo, prisma, scorer);
  });

  it('onDetected: нет сессии → открывает с камерой', async () => {
    repo.findOpen.mockResolvedValue(null);
    repo.open.mockResolvedValue(session({ visitedCameras: ['camA'] }));
    await service.onDetected('s1', '7', 'camA');
    expect(repo.open).toHaveBeenCalledWith(
      expect.objectContaining({ visitedCameras: ['camA'], storeId: 's1' }),
    );
  });

  it('onDetected: новая камера → добавляет в visitedCameras', async () => {
    repo.findOpen.mockResolvedValue(session({ visitedCameras: ['camA'] }));
    await service.onDetected('s1', '7', 'camB');
    expect(repo.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ visitedCameras: ['camA', 'camB'] }),
    );
  });

  it('onProductTaken: инкремент + пересчёт риска', async () => {
    repo.findOpen.mockResolvedValue(session());
    await service.onProductTaken('s1', '7');
    expect(repo.update).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ productsTaken: 1, riskScore: 25, behaviorType: 'SHOPPER' }),
    );
  });

  it('onExited: закрывает с финальным risk score', async () => {
    repo.findOpen.mockResolvedValue(
      session({ productsTaken: 1, metadata: { suspiciousCount: 1 } }),
    );
    await service.onExited('s1', '7');
    const [id, data] = repo.update.mock.calls[0];
    expect(id).toBe('b1');
    expect(data.endedAt).toBeInstanceOf(Date);
    expect(data.duration).toBeGreaterThanOrEqual(29);
    expect(data.riskScore).toBe(75); // 1*25 + 1*50
    expect(data.behaviorType).toBe('THEFT_SUSPECT');
  });

  it('onExited: нет открытой сессии → ничего', async () => {
    repo.findOpen.mockResolvedValue(null);
    await service.onExited('s1', '7');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
