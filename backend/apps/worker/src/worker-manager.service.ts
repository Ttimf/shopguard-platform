import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { RegisterWorkerDto, WorkerHeartbeatDto } from '@app/contracts';

/**
 * WorkerManager: учёт AI-воркеров (ai-detection) — регистрация при старте
 * и heartbeat каждые ~5с. Данные хранятся в таблице AiWorker (upsert по id).
 */
@Injectable()
export class WorkerManagerService {
  private readonly logger = new Logger('WorkerManager');

  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterWorkerDto) {
    const startedAt = new Date(dto.startedAt);
    const now = new Date();
    const common = {
      hostname: dto.hostname,
      version: dto.version,
      gpuName: dto.gpuName ?? null,
      gpuMemory: dto.gpuMemory ?? null,
      cuda: dto.cuda ?? null,
      driverVersion: dto.driverVersion ?? null,
      status: 'ONLINE',
      startedAt,
      lastSeen: now,
    };
    await this.prisma.aiWorker.upsert({
      where: { id: dto.workerId },
      create: { id: dto.workerId, ...common },
      update: common,
    });
    this.logger.log(
      `зарегистрирован ${dto.workerId} (${dto.hostname}, GPU=${dto.gpuName ?? 'нет'})`,
    );
    return { ok: true, workerId: dto.workerId };
  }

  async heartbeat(dto: WorkerHeartbeatDto) {
    // updateMany не бросает, если воркер ещё не зарегистрирован
    await this.prisma.aiWorker.updateMany({
      where: { id: dto.workerId },
      data: {
        status: dto.status ?? 'ONLINE',
        lastSeen: new Date(),
        gpuUsage: dto.gpuUsage ?? null,
        vramUsed: dto.vramUsed ?? null,
        temperature: dto.temperature ?? null,
        power: dto.power ?? null,
        cpu: dto.cpu ?? null,
        ram: dto.ram ?? null,
        fps: dto.fps ?? null,
        cameras: dto.cameras ?? null,
        tracks: dto.tracks ?? null,
      },
    });
    return { ok: true };
  }
}
