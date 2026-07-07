// Контракты camera-service: паттерны сообщений (gateway ↔ camera) + DTO/представления.

export const CAMERA_PATTERNS = {
  // магазины (нужны как контейнер для камер)
  STORE_CREATE: 'camera.store.create',
  STORE_LIST: 'camera.store.list',
  STORE_SET_TELEGRAM: 'camera.store.telegram',
  STORE_SET_MODEL: 'camera.store.model', // A/B: закрепить модель за магазином
  MODELS_LIST: 'camera.models.list', // доступные модели (из ai-detection)
  // камеры
  CREATE: 'camera.create',
  LIST: 'camera.list', // камеры магазина
  LIST_ALL: 'camera.list_all', // все камеры владельца
  GET: 'camera.get',
  UPDATE: 'camera.update',
  DELETE: 'camera.delete',
  TEST: 'camera.test', // проверка RTSP-соединения
  SNAPSHOT: 'camera.snapshot', // текущий кадр
  // зоны и поведение
  ZONES_SET: 'camera.zones.set',
  BEHAVIOR_SET: 'camera.behavior.set',
  // конфигурация для ai-detection (внутренний, с расшифрованным RTSP)
  CONFIG_LIST: 'camera.config.list',
  // чёрный список (лица)
  BLACKLIST_CREATE: 'camera.blacklist.create',
  BLACKLIST_LIST: 'camera.blacklist.list',
  BLACKLIST_DELETE: 'camera.blacklist.delete',
  BLACKLIST_CONFIG: 'camera.blacklist.config', // для ai-detection
};

export type ZoneKind = 'SHELF' | 'EXIT';

// ---- входные данные (ownerId проставляет gateway из JWT) ----

export interface CreateStoreDto {
  ownerId: string;
  name: string;
  address?: string;
}

export interface CreateCameraDto {
  ownerId: string;
  storeId: string;
  name: string;
  rtspUrl: string;
  username?: string;
  password?: string;
  description?: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  fpsLimit?: number;
}

export interface UpdateCameraDto {
  ownerId: string;
  cameraId: string;
  name?: string;
  enabled?: boolean;
  fpsLimit?: number;
  rtspUrl?: string;
  username?: string;
  password?: string; // пустая строка — очистить пароль
  description?: string;
  manufacturer?: string;
  model?: string;
  location?: string;
}

export type CameraStatusValue = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface ZoneInput {
  type: ZoneKind;
  polygon: number[][]; // [[x,y], ...]
}

export interface SetZonesDto {
  ownerId: string;
  cameraId: string;
  zones: ZoneInput[];
}

export interface SetBehaviorDto {
  ownerId: string;
  cameraId: string;
  shelfDwellSeconds: number;
  exitConfirmSeconds: number;
  maxPersonLostSeconds: number;
}

// ---- представления (без секретов) ----

export interface StoreView {
  id: string;
  name: string;
  address: string | null;
  telegramChatId: string | null;
  modelOverride: string | null;
  createdAt: string;
}

export interface SetTelegramDto {
  ownerId: string;
  storeId: string;
  chatId: string | null; // null — отключить
}

export interface SetModelDto {
  ownerId: string;
  storeId: string;
  model: string | null; // null — вернуть на модель по умолчанию
}

export interface CameraView {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  rtspUrl: string; // базовый URL без кредов (для владельца)
  username: string | null;
  hasPassword: boolean; // сам пароль не отдаётся
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  enabled: boolean;
  status: CameraStatusValue;
  fpsLimit: number;
  fps: number | null;
  resolution: string | null;
  lastOnline: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Результат проверки RTSP-соединения (ai-detection → camera-service). */
export interface CameraTestResult {
  online: boolean;
  latency?: number; // мс
  fps?: number;
  resolution?: string;
  manufacturer?: string | null; // авто-определение (best-effort)
  model?: string | null;
  error?: string;
}

export interface ZoneView {
  id: string;
  type: ZoneKind;
  polygon: number[][];
}

export interface BehaviorView {
  shelfDwellSeconds: number;
  exitConfirmSeconds: number;
  maxPersonLostSeconds: number;
}

export interface CameraDetail extends CameraView {
  zones: ZoneView[];
  behavior: BehaviorView | null;
}

// ---- конфигурация для ai-detection (RTSP расшифрован!) ----

export interface CameraConfig {
  id: string;
  storeId: string;
  name: string;
  rtspUrl: string;
  fpsLimit: number;
  zones: ZoneView[];
  behavior: BehaviorView;
  modelOverride: string | null; // A/B: модель магазина (null → default)
}

// ---- чёрный список (лица) ----

export interface CreateBlacklistDto {
  ownerId: string;
  storeId: string;
  name: string;
  photoKey: string; // ключ фото в S3 (gateway загрузил заранее)
}

export interface BlacklistPersonView {
  id: string;
  storeId: string;
  name: string;
  photoKey: string | null;
  createdAt: string;
}

/** Запись чёрного списка для ai-detection (эмбеддинг считается в памяти по фото). */
export interface BlacklistEntry {
  storeId: string;
  name: string;
  photoKey: string;
}
