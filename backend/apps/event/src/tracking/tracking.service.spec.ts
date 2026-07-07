import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  let repo: any;
  let prisma: any;
  let service: TrackingService;

  beforeEach(() => {
    repo = {
      findOpenOnCamera: jest.fn(),
      findOpen: jest.fn(),
      open: jest.fn(),
      close: jest.fn(),
    };
    prisma = { store: { findMany: jest.fn() } };
    service = new TrackingService(repo, prisma);
  });

  it('onDetected: нет открытого → открывает сегмент', async () => {
    repo.findOpenOnCamera.mockResolvedValue(null);
    repo.findOpen.mockResolvedValue(null);
    await service.onDetected('s1', 'camA', '7');
    expect(repo.open).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: 's1', cameraId: 'camA', trackingId: '7' }),
    );
    expect(repo.close).not.toHaveBeenCalled();
  });

  it('onDetected: уже открыт на этой камере → ничего', async () => {
    repo.findOpenOnCamera.mockResolvedValue({ id: 't1' });
    await service.onDetected('s1', 'camA', '7');
    expect(repo.open).not.toHaveBeenCalled();
    expect(repo.close).not.toHaveBeenCalled();
  });

  it('onDetected: открыт на другой камере → хэндофф (закрыть + открыть)', async () => {
    repo.findOpenOnCamera.mockResolvedValue(null);
    repo.findOpen.mockResolvedValue({
      id: 't1',
      cameraId: 'camA',
      enteredAt: new Date(Date.now() - 3000),
      metadata: null,
    });
    await service.onDetected('s1', 'camB', '7');
    expect(repo.close).toHaveBeenCalledWith(
      't1',
      expect.any(Date),
      expect.any(Number),
      expect.objectContaining({ reason: 'handoff', toCamera: 'camB' }),
    );
    expect(repo.open).toHaveBeenCalledWith(
      expect.objectContaining({
        cameraId: 'camB',
        metadata: { fromCamera: 'camA' },
      }),
    );
  });

  it('onExited: закрывает открытый сегмент с длительностью', async () => {
    repo.findOpenOnCamera.mockResolvedValue({
      id: 't2',
      enteredAt: new Date(Date.now() - 5000),
      metadata: null,
    });
    await service.onExited('s1', 'camA', '7');
    const [id, , duration] = repo.close.mock.calls[0];
    expect(id).toBe('t2');
    expect(duration).toBeGreaterThanOrEqual(4);
  });

  it('onExited: нет открытого → ничего не делает', async () => {
    repo.findOpenOnCamera.mockResolvedValue(null);
    await service.onExited('s1', 'camA', '7');
    expect(repo.close).not.toHaveBeenCalled();
  });
});
