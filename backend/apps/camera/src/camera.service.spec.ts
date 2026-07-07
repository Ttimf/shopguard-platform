import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CameraService } from './camera.service';

describe('CameraService (владение)', () => {
  let prisma: any;
  let crypto: any;
  let service: CameraService;

  beforeEach(() => {
    prisma = {
      store: { findUnique: jest.fn() },
      camera: { findUnique: jest.fn(), create: jest.fn() },
    };
    crypto = { encrypt: jest.fn(() => 'ENC'), decrypt: jest.fn(() => 'URL') };
    service = new CameraService(prisma, crypto);
  });

  const dto = {
    ownerId: 'o1',
    storeId: 's1',
    name: 'Cam',
    rtspUrl: 'rtsp://host/s',
  };

  // полная строка камеры (как из Prisma) — чтобы view() не падал
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'c1',
    storeId: 's1',
    name: 'Cam',
    description: null,
    rtspUrlEnc: 'ENC',
    username: null,
    passwordEnc: null,
    manufacturer: null,
    model: null,
    location: null,
    enabled: true,
    status: 'UNKNOWN',
    fpsLimit: 15,
    fps: null,
    resolution: null,
    lastOnline: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  it('create: магазин не найден → 404', async () => {
    prisma.store.findUnique.mockResolvedValue(null);
    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create: чужой магазин → 403', async () => {
    prisma.store.findUnique.mockResolvedValue({ id: 's1', ownerId: 'other' });
    await expect(service.create(dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('create: успех → шифрует базовый URL, пароль не отдаётся', async () => {
    prisma.store.findUnique.mockResolvedValue({ id: 's1', ownerId: 'o1' });
    prisma.camera.create.mockResolvedValue(row());
    const view = await service.create(dto);
    expect(crypto.encrypt).toHaveBeenCalledWith('rtsp://host/s');
    expect(view).not.toHaveProperty('password');
    expect(view.hasPassword).toBe(false);
    expect(view.status).toBe('UNKNOWN');
    expect(view.id).toBe('c1');
  });

  it('create: URL со встроенными кредами → креды вынесены, база без кредов', async () => {
    prisma.store.findUnique.mockResolvedValue({ id: 's1', ownerId: 'o1' });
    prisma.camera.create.mockResolvedValue(
      row({ username: 'admin', passwordEnc: 'ENC' }),
    );
    await service.create({
      ...dto,
      rtspUrl: 'rtsp://admin:secret@192.168.1.10:554/stream',
    });
    // база без кредов + пароль отдельно зашифрован
    expect(crypto.encrypt).toHaveBeenCalledWith(
      'rtsp://192.168.1.10:554/stream',
    );
    expect(crypto.encrypt).toHaveBeenCalledWith('secret');
    const data = prisma.camera.create.mock.calls[0][0].data;
    expect(data.username).toBe('admin');
    expect(data.passwordEnc).toBe('ENC');
  });

  it('get: чужая камера → 403', async () => {
    prisma.camera.findUnique.mockResolvedValue({
      id: 'c1',
      store: { ownerId: 'other' },
      zones: [],
      behavior: null,
    });
    await expect(service.get('o1', 'c1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('get: камера не найдена → 404', async () => {
    prisma.camera.findUnique.mockResolvedValue(null);
    await expect(service.get('o1', 'c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
