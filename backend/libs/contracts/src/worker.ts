// Контракты AI Worker: регистрация и heartbeat узлов ai-detection
// (ai-detection → worker-service через Redis, request/reply).

export const WORKER_PATTERNS = {
  REGISTER: 'worker.register',
  HEARTBEAT: 'worker.heartbeat',
};

/** Регистрация воркера при старте. */
export interface RegisterWorkerDto {
  workerId: string; // UUID, генерируется самим воркером
  hostname: string;
  version: string;
  gpuName?: string | null;
  gpuMemory?: number | null; // МБ
  cuda?: string | null;
  driverVersion?: string | null;
  startedAt: string; // ISO
}

/** Периодический heartbeat (каждые ~5с) с метриками. */
export interface WorkerHeartbeatDto {
  workerId: string;
  status?: string; // ONLINE | OFFLINE
  gpuUsage?: number | null; // %
  vramUsed?: number | null; // МБ
  temperature?: number | null; // °C
  power?: number | null; // Вт
  cpu?: number | null; // %
  ram?: number | null; // %
  fps?: number | null;
  cameras?: number | null;
  tracks?: number | null;
}

/** Представление воркера (для будущих API/админки). */
export interface AiWorkerView {
  id: string;
  hostname: string;
  version: string;
  gpuName: string | null;
  gpuMemory: number | null;
  cuda: string | null;
  driverVersion: string | null;
  status: string;
  startedAt: string;
  lastSeen: string;
  gpuUsage: number | null;
  vramUsed: number | null;
  temperature: number | null;
  power: number | null;
  cpu: number | null;
  ram: number | null;
  fps: number | null;
  cameras: number | null;
  tracks: number | null;
}
