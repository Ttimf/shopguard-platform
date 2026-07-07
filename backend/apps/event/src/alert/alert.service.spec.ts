import { AlertService } from './alert.service';
import { AlertPolicy } from './alert-policy';

const policy = new AlertPolicy({ riskThreshold: 60, cameraOfflineSeverity: 'MEDIUM' });

const mismatch = (metaStatus: string) => ({
  eventId: 'e',
  storeId: 's1',
  trackingId: 7,
  eventType: 'PurchaseMismatch',
  timestamp: new Date().toISOString(),
  confidence: 0,
  metadata: { status: metaStatus, missing: ['b'] },
});

describe('AlertService', () => {
  let repo: any;
  let prisma: any;
  let bus: any;
  let service: AlertService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockImplementation((d) => ({ id: 'a1', ...d })),
      findById: jest.fn(),
      findMany: jest.fn(),
    };
    prisma = {
      behaviorSession: { findFirst: jest.fn() },
      purchaseSession: { findFirst: jest.fn() },
      store: { findMany: jest.fn() },
    };
    bus = { publish: jest.fn() };
    service = new AlertService(repo, prisma, policy, bus);
  });

  it('высокий риск + NOT_MATCHED → THEFT_ALERT HIGH + AlertCreated', async () => {
    prisma.behaviorSession.findFirst.mockResolvedValue({ id: 'b1', riskScore: 80 });
    prisma.purchaseSession.findFirst.mockResolvedValue({
      id: 'p1', status: 'NOT_MATCHED', confidence: 0,
    });
    await service.onPurchaseMismatch(mismatch('NOT_MATCHED') as any);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: 'THEFT_ALERT',
        severity: 'HIGH',
        behaviorSessionId: 'b1',
        purchaseSessionId: 'p1',
        riskScore: 80,
      }),
    );
    expect(bus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'AlertCreated' }),
    );
  });

  it('MATCHED + низкий риск → тревога не создаётся', async () => {
    prisma.behaviorSession.findFirst.mockResolvedValue({ id: 'b1', riskScore: 5 });
    prisma.purchaseSession.findFirst.mockResolvedValue({
      id: 'p1', status: 'MATCHED', confidence: 100,
    });
    await service.onPurchaseMismatch(mismatch('MATCHED') as any);
    expect(repo.create).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it('нет поведения → риск 0, NOT_MATCHED → THEFT_ALERT MEDIUM', async () => {
    prisma.behaviorSession.findFirst.mockResolvedValue(null);
    prisma.purchaseSession.findFirst.mockResolvedValue({
      id: 'p1', status: 'NOT_MATCHED', confidence: 0,
    });
    await service.onPurchaseMismatch(mismatch('NOT_MATCHED') as any);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'MEDIUM', riskScore: 0 }),
    );
  });

  it('CameraOffline → CAMERA_OFFLINE + AlertCreated', async () => {
    await service.onCameraOffline({
      eventId: 'e', storeId: 's1', cameraId: 'cam1',
      eventType: 'CameraOffline', timestamp: new Date().toISOString(),
    } as any);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: 'CAMERA_OFFLINE', severity: 'MEDIUM' }),
    );
    expect(bus.publish).toHaveBeenCalled();
  });
});
