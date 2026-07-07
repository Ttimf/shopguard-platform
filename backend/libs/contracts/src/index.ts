export * from './auth';
export * from './camera';
export * from './notification';
export * from './event';

// Общие контракты между сервисами (единый язык событий).

export enum DetectionType {
  THEFT = 'theft', // подозрение на кражу
  BLACKLIST = 'blacklist', // человек из чёрного списка
}

/** Событие от ai-detection → notification (через Redis Streams). */
export interface DetectionEvent {
  cameraId: string;
  type: DetectionType;
  trackId?: number;
  personName?: string; // для blacklist
  confidence?: number;
  clipKey?: string; // ключ видеоклипа в S3
  snapshotKey?: string; // ключ снимка в S3
  modelVersion?: string; // A/B: модель, поймавшая событие
  createdAt: string; // ISO
}

/** Каналы Redis (шина событий). */
export const REDIS_STREAMS = {
  DETECTION_EVENTS: 'detection.events',
};

export const REDIS_PATTERNS = {
  HEALTH_PING: 'health.ping',
};
