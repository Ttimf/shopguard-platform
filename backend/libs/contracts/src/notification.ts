// Контракты notification-service: список/статус событий + канал WS-тревог.

export const NOTIFICATION_PATTERNS = {
  EVENTS_LIST: 'notification.events.list',
  EVENT_STATUS: 'notification.event.status',
};

export type EventKind = 'THEFT' | 'BLACKLIST';
export type EventStatusValue = 'NEW' | 'REVIEWED' | 'FALSE_ALARM';

export interface EventView {
  id: string;
  storeId: string;
  cameraId: string;
  cameraName: string;
  type: EventKind;
  trackId: number | null;
  personName: string | null;
  confidence: number | null;
  snapshotKey: string | null;
  clipKey: string | null;
  modelVersion: string | null; // A/B: модель, поймавшая событие
  status: EventStatusValue;
  createdAt: string;
}

export interface ListEventsDto {
  ownerId: string;
  storeId: string;
  status?: EventStatusValue;
}

export interface UpdateEventStatusDto {
  ownerId: string;
  eventId: string;
  status: EventStatusValue;
}

/** Redis pub/sub канал живых тревог (notification → gateway WS). */
export const ALERTS_CHANNEL = 'alerts';

/** Полезная нагрузка тревоги для WebSocket. */
export interface AlertPayload {
  storeId: string;
  event: EventView;
}
