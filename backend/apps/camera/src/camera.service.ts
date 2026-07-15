import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@app/common';
import {
  BehaviorView,
  CameraConfig,
  CameraDetail,
  CameraTestResult,
  CameraView,
  CreateCameraDto,
  SetBehaviorDto,
  SetZonesDto,
  UpdateCameraDto,
  ZoneView,
} from '@app/contracts';
import { CryptoService } from './crypto.service';

const AI_URL = process.env.AI_DETECTION_URL ?? 'http://localhost:8000';

// Воркер считается живым, если heartbeat был не позже WORKER_STALE_SECONDS
// (по умолчанию 30с — 6× интервал heartbeat). Умерший выпадает из шардинга,
// и его камеры на следующем опросе переназначаются оставшимся.
const WORKER_STALE_MS =
  (Number(process.env.WORKER_STALE_SECONDS) || 30) * 1000;

/**
 * Детерминированный 32-бит хэш строки (FNV-1a + финальное перемешивание fmix).
 * Хорошее лавинообразование — корректная равномерность для rendezvous-хэширования
 * независимо от структуры id (UUID и т.п.).
 */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

const DEFAULT_BEHAVIOR = {
  shelfDwellSeconds: 3.0,
  exitConfirmSeconds: 5.0,
  maxPersonLostSeconds: 10.0,
};

@Injectable()
export class CameraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async create(dto: CreateCameraDto): Promise<CameraView> {
    await this.assertStoreOwner(dto.storeId, dto.ownerId);
    const { base, username, password } = this.splitCreds(
      dto.rtspUrl,
      dto.username,
      dto.password,
    );
    const camera = await this.prisma.camera.create({
      data: {
        storeId: dto.storeId,
        name: dto.name,
        description: dto.description ?? null,
        rtspUrlEnc: this.crypto.encrypt(base),
        username: username ?? null,
        passwordEnc: password ? this.crypto.encrypt(password) : null,
        manufacturer: dto.manufacturer ?? null,
        model: dto.model ?? null,
        location: dto.location ?? null,
        fpsLimit: dto.fpsLimit ?? 15,
      },
    });
    return this.view(camera);
  }

  async list(ownerId: string, storeId: string): Promise<CameraView[]> {
    await this.assertStoreOwner(storeId, ownerId);
    const cameras = await this.prisma.camera.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
    });
    return cameras.map((c) => this.view(c));
  }

  /** Все камеры владельца (по всем его магазинам). */
  async listAll(ownerId: string): Promise<CameraView[]> {
    const cameras = await this.prisma.camera.findMany({
      where: { store: { ownerId } },
      orderBy: { createdAt: 'asc' },
    });
    return cameras.map((c) => this.view(c));
  }

  async get(ownerId: string, cameraId: string): Promise<CameraDetail> {
    const camera = await this.ownedCamera(cameraId, ownerId, true);
    return {
      ...this.view(camera),
      zones: camera.zones.map((z) => this.zoneView(z)),
      behavior: camera.behavior
        ? {
            shelfDwellSeconds: camera.behavior.shelfDwellSeconds,
            exitConfirmSeconds: camera.behavior.exitConfirmSeconds,
            maxPersonLostSeconds: camera.behavior.maxPersonLostSeconds,
          }
        : null,
    };
  }

  async update(dto: UpdateCameraDto): Promise<CameraView> {
    await this.ownedCamera(dto.cameraId, dto.ownerId);
    const data: Record<string, unknown> = {
      name: dto.name,
      enabled: dto.enabled,
      fpsLimit: dto.fpsLimit,
      description: dto.description,
      manufacturer: dto.manufacturer,
      model: dto.model,
      location: dto.location,
    };
    if (dto.rtspUrl !== undefined) {
      const { base, username, password } = this.splitCreds(
        dto.rtspUrl,
        dto.username,
        dto.password,
      );
      data.rtspUrlEnc = this.crypto.encrypt(base);
      data.username = username ?? null;
      data.passwordEnc = password ? this.crypto.encrypt(password) : null;
    } else {
      if (dto.username !== undefined) data.username = dto.username || null;
      if (dto.password !== undefined) {
        data.passwordEnc = dto.password ? this.crypto.encrypt(dto.password) : null;
      }
    }
    const camera = await this.prisma.camera.update({
      where: { id: dto.cameraId },
      data,
    });
    return this.view(camera);
  }

  async remove(ownerId: string, cameraId: string): Promise<{ id: string }> {
    await this.ownedCamera(cameraId, ownerId);
    await this.prisma.camera.delete({ where: { id: cameraId } });
    return { id: cameraId };
  }

  /** Проверка RTSP-соединения (видео открывает ai-detection) + запись статуса. */
  async testCamera(
    ownerId: string,
    cameraId: string,
  ): Promise<CameraTestResult> {
    const cam = await this.ownedCamera(cameraId, ownerId);
    const url = this.connectionUrl(cam);
    let result: CameraTestResult;
    try {
      const res = await fetch(`${AI_URL}/internal/camera/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rtspUrl: url }),
      });
      result = (await res.json()) as CameraTestResult;
    } catch {
      result = { online: false, error: 'AI-сервис недоступен' };
    }
    await this.prisma.camera.update({
      where: { id: cameraId },
      data: {
        status: result.online ? 'ONLINE' : 'OFFLINE',
        lastOnline: result.online ? new Date() : undefined,
        fps: result.fps ?? undefined,
        resolution: result.resolution ?? undefined,
        // авто-определение вендора — только если поле ещё пустое (не затираем ручной ввод)
        manufacturer:
          !cam.manufacturer && result.manufacturer
            ? result.manufacturer
            : undefined,
        model: !cam.model && result.model ? result.model : undefined,
      },
    });
    return result;
  }

  /** Текущий кадр камеры (base64 JPEG). */
  async snapshot(ownerId: string, cameraId: string): Promise<{ image: string }> {
    const cam = await this.ownedCamera(cameraId, ownerId);
    const url = this.connectionUrl(cam);
    let data: { online: boolean; image?: string; error?: string };
    try {
      const res = await fetch(`${AI_URL}/internal/camera/snapshot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cameraId, rtspUrl: url }),
      });
      data = await res.json();
    } catch {
      throw new ServiceUnavailableException('AI-сервис недоступен');
    }
    if (!data.online || !data.image) {
      throw new ServiceUnavailableException(
        data.error ?? 'Снимок недоступен',
      );
    }
    return { image: data.image };
  }

  /** Полный RTSP-URL с кредами для подключения. */
  private connectionUrl(cam: {
    rtspUrlEnc: string;
    username: string | null;
    passwordEnc: string | null;
  }): string {
    return this.composeRtsp(
      this.crypto.decrypt(cam.rtspUrlEnc),
      cam.username,
      cam.passwordEnc ? this.crypto.decrypt(cam.passwordEnc) : undefined,
    );
  }

  /** Полная замена набора зон камеры. */
  async setZones(dto: SetZonesDto): Promise<ZoneView[]> {
    await this.ownedCamera(dto.cameraId, dto.ownerId);
    await this.prisma.$transaction([
      this.prisma.zone.deleteMany({ where: { cameraId: dto.cameraId } }),
      this.prisma.zone.createMany({
        data: dto.zones.map((z) => ({
          cameraId: dto.cameraId,
          type: z.type,
          polygon: z.polygon,
        })),
      }),
    ]);
    const zones = await this.prisma.zone.findMany({
      where: { cameraId: dto.cameraId },
    });
    return zones.map((z) => this.zoneView(z));
  }

  async setBehavior(dto: SetBehaviorDto): Promise<BehaviorView> {
    await this.ownedCamera(dto.cameraId, dto.ownerId);
    const data = {
      shelfDwellSeconds: dto.shelfDwellSeconds,
      exitConfirmSeconds: dto.exitConfirmSeconds,
      maxPersonLostSeconds: dto.maxPersonLostSeconds,
    };
    const saved = await this.prisma.behaviorSettings.upsert({
      where: { cameraId: dto.cameraId },
      create: { cameraId: dto.cameraId, ...data },
      update: data,
    });
    return {
      shelfDwellSeconds: saved.shelfDwellSeconds,
      exitConfirmSeconds: saved.exitConfirmSeconds,
      maxPersonLostSeconds: saved.maxPersonLostSeconds,
    };
  }

  /** Конфигурация активных камер для ai-detection (RTSP расшифрован). */
  async configList(workerId?: string): Promise<CameraConfig[]> {
    const cameras = await this.prisma.camera.findMany({
      where: { enabled: true },
      include: { zones: true, behavior: true, store: true },
    });
    const configs = cameras.map((c) => ({
      id: c.id,
      storeId: c.storeId,
      name: c.name,
      rtspUrl: this.composeRtsp(
        this.crypto.decrypt(c.rtspUrlEnc),
        c.username,
        c.passwordEnc ? this.crypto.decrypt(c.passwordEnc) : undefined,
      ),
      fpsLimit: c.fpsLimit,
      zones: c.zones.map((z) => this.zoneView(z)),
      behavior: c.behavior
        ? {
            shelfDwellSeconds: c.behavior.shelfDwellSeconds,
            exitConfirmSeconds: c.behavior.exitConfirmSeconds,
            maxPersonLostSeconds: c.behavior.maxPersonLostSeconds,
          }
        : { ...DEFAULT_BEHAVIOR },
      modelOverride: c.store.modelOverride,
    }));
    return this.shardForWorker(configs, workerId);
  }

  /**
   * Назначение камер конкретному воркеру: каждая камера — ровно одному живому
   * воркеру (детерминированный hash(cameraId) % N по отсортированному списку
   * живых). При отключении воркера его lastSeen устаревает → он выпадает, и
   * камеры переназначаются оставшимся на следующем опросе конфига.
   * Обратная совместимость: без workerId (старый воркер) или если вызывающий
   * воркер ещё не в списке живых — fail-open: отдаём все камеры.
   */
  private async shardForWorker(
    configs: CameraConfig[],
    workerId?: string,
  ): Promise<CameraConfig[]> {
    if (!workerId) return configs;
    const since = new Date(Date.now() - WORKER_STALE_MS);
    const workers = await this.prisma.aiWorker.findMany({
      where: { lastSeen: { gte: since } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const ids = workers.map((w) => w.id);
    if (!ids.includes(workerId)) return configs; // не зарегистрирован → все
    // Rendezvous hashing (HRW): камера → воркер с максимальным hash(cam:worker).
    // При отключении воркера переназначаются только ЕГО камеры (живые не трогаются).
    return configs.filter((c) => this.hrwOwner(c.id, ids) === workerId);
  }

  private hrwOwner(cameraId: string, workerIds: string[]): string {
    let best = '';
    let bestHash = -1;
    for (const id of workerIds) {
      const h = hashStr(`${cameraId}:${id}`);
      if (h > bestHash || (h === bestHash && id > best)) {
        bestHash = h;
        best = id;
      }
    }
    return best;
  }

  // ---- вспомогательные ----

  private async assertStoreOwner(storeId: string, ownerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException('Магазин не найден');
    if (store.ownerId !== ownerId) {
      throw new ForbiddenException('Нет доступа к магазину');
    }
  }

  private async ownedCamera(cameraId: string, ownerId: string, withRelations = false) {
    const camera = await this.prisma.camera.findUnique({
      where: { id: cameraId },
      include: withRelations
        ? { store: true, zones: true, behavior: true }
        : { store: true },
    });
    if (!camera) throw new NotFoundException('Камера не найдена');
    if (camera.store.ownerId !== ownerId) {
      throw new ForbiddenException('Нет доступа к камере');
    }
    return camera as typeof camera & {
      zones: any[];
      behavior: any;
    };
  }

  private view(c: {
    id: string;
    storeId: string;
    name: string;
    description: string | null;
    rtspUrlEnc: string;
    username: string | null;
    passwordEnc: string | null;
    manufacturer: string | null;
    model: string | null;
    location: string | null;
    enabled: boolean;
    status: string;
    fpsLimit: number;
    fps: number | null;
    resolution: string | null;
    lastOnline: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): CameraView {
    return {
      id: c.id,
      storeId: c.storeId,
      name: c.name,
      description: c.description,
      rtspUrl: this.crypto.decrypt(c.rtspUrlEnc), // базовый URL без кредов
      username: c.username,
      hasPassword: c.passwordEnc != null,
      manufacturer: c.manufacturer,
      model: c.model,
      location: c.location,
      enabled: c.enabled,
      status: c.status as CameraView['status'],
      fpsLimit: c.fpsLimit,
      fps: c.fps,
      resolution: c.resolution,
      lastOnline: c.lastOnline ? c.lastOnline.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  // ---- RTSP-креды ----

  /** Разбирает URL, применяя явные креды поверх встроенных; возвращает базовый URL без кредов. */
  private splitCreds(
    url: string,
    explicitUser?: string,
    explicitPass?: string,
  ): { base: string; username?: string; password?: string } {
    const parsed = this.parseRtsp(url);
    return {
      base: parsed.base,
      username: explicitUser ?? parsed.username,
      password: explicitPass ?? parsed.password,
    };
  }

  private parseRtsp(url: string): {
    base: string;
    username?: string;
    password?: string;
  } {
    try {
      const u = new URL(url);
      const username = u.username ? decodeURIComponent(u.username) : undefined;
      const password = u.password ? decodeURIComponent(u.password) : undefined;
      const base = `${u.protocol}//${u.host}${u.pathname}${u.search}`;
      return { base, username, password };
    } catch {
      return { base: url };
    }
  }

  /** Собирает URL с кредами для подключения (AI/тест). */
  private composeRtsp(
    base: string,
    username?: string | null,
    password?: string | null,
  ): string {
    if (!username) return base;
    try {
      const u = new URL(base);
      const creds = password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : `${encodeURIComponent(username)}@`;
      return `${u.protocol}//${creds}${u.host}${u.pathname}${u.search}`;
    } catch {
      return base;
    }
  }

  private zoneView(z: { id: string; type: string; polygon: unknown }): ZoneView {
    return {
      id: z.id,
      type: z.type as ZoneView['type'],
      polygon: z.polygon as number[][],
    };
  }
}
