import { EventService } from './event.service';

describe('EventService.persist', () => {
  let prisma: any;
  let service: EventService;

  beforeEach(() => {
    prisma = {
      camera: { findUnique: jest.fn() },
      event: { create: jest.fn() },
    };
    service = new EventService(prisma);
  });

  const camera = {
    id: 'c1',
    name: 'Kassa',
    storeId: 's1',
    store: { ownerId: 'o1', telegramChatId: '555' },
  };

  it('камера удалена → null', async () => {
    prisma.camera.findUnique.mockResolvedValue(null);
    const res = await service.persist({ cameraId: 'gone', type: 'theft' });
    expect(res).toBeNull();
  });

  it('theft → view + telegramChatId', async () => {
    prisma.camera.findUnique.mockResolvedValue(camera);
    prisma.event.create.mockResolvedValue({
      id: 'e1',
      cameraId: 'c1',
      type: 'THEFT',
      trackId: 7,
      personName: null,
      confidence: 0.9,
      snapshotKey: 'k.jpg',
      clipKey: null,
      status: 'NEW',
      createdAt: new Date(),
    });
    const res = await service.persist({
      cameraId: 'c1',
      type: 'theft',
      trackId: '7',
      confidence: '0.9',
      snapshotKey: 'k.jpg',
    });
    expect(res).not.toBeNull();
    expect(res!.view.type).toBe('THEFT');
    expect(res!.view.storeId).toBe('s1');
    expect(res!.view.cameraName).toBe('Kassa');
    expect(res!.telegramChatId).toBe('555');
  });

  it('blacklist → тип BLACKLIST в БД', async () => {
    prisma.camera.findUnique.mockResolvedValue(camera);
    prisma.event.create.mockResolvedValue({
      id: 'e2',
      cameraId: 'c1',
      type: 'BLACKLIST',
      trackId: null,
      personName: 'Иван',
      confidence: 0.8,
      snapshotKey: null,
      clipKey: null,
      status: 'NEW',
      createdAt: new Date(),
    });
    await service.persist({
      cameraId: 'c1',
      type: 'blacklist',
      personName: 'Иван',
    });
    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'BLACKLIST', personName: 'Иван' }),
      }),
    );
  });
});
