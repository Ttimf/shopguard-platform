// Event Engine — обобщённое ядро событий (отдельно от алертов Event/notification).

export enum EngineEventType {
  PERSON_DETECTED = 'PersonDetected',
  PERSON_ENTERED = 'PersonEntered',
  PERSON_EXITED = 'PersonExited',
  PRODUCT_TAKEN = 'ProductTaken',
  PRODUCT_RETURNED = 'ProductReturned',
  SUSPICIOUS_ACTIVITY = 'SuspiciousActivity',
  CAMERA_OFFLINE = 'CameraOffline',
  CAMERA_ONLINE = 'CameraOnline',
  MODEL_SWITCHED = 'ModelSwitched',
  PURCHASE_MISMATCH = 'PurchaseMismatch',
  ALERT_CREATED = 'AlertCreated',
}

/** Базовый интерфейс события шины. */
export interface EngineEvent {
  eventId: string;
  storeId: string;
  cameraId?: string | null;
  trackingId?: number | null;
  eventType: EngineEventType | string;
  timestamp: string; // ISO
  confidence?: number | null;
  modelVersion?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Redis-шина событий движка (Event Bus). Событие — JSON в поле `data`. */
export const EVENTS_STREAM = 'events.stream';

export const EVENT_PATTERNS = {
  LIST: 'event.list',
  GET: 'event.get',
};

export interface ListEngineEventsDto {
  ownerId: string;
  storeId?: string;
  cameraId?: string;
  eventType?: string;
  modelVersion?: string;
  from?: string; // ISO — начало периода
  to?: string; // ISO — конец периода
  limit?: number;
}

export interface EngineEventView extends EngineEvent {
  createdAt: string;
}

// ---- Tracking Engine (Этап 14.2) ----

export const TRACKING_PATTERNS = {
  LIST: 'tracking.list',
  GET: 'tracking.get',
};

/** Сегмент присутствия человека на одной камере. */
export interface PersonTrackView {
  id: string;
  trackingId: string;
  storeId: string;
  cameraId: string;
  enteredAt: string;
  exitedAt: string | null;
  duration: number | null; // секунды
  active: boolean; // маршрут ещё открыт
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListTracksDto {
  ownerId: string;
  storeId?: string;
  cameraId?: string;
  trackingId?: string;
  active?: boolean; // только открытые/закрытые
  from?: string; // ISO — по enteredAt
  to?: string;
  limit?: number;
}

// ---- Behavior Engine (Этап 14.3) ----

export type BehaviorType =
  | 'BROWSER' // просто ходил
  | 'SHOPPER' // взял товар
  | 'SUSPICIOUS' // повышенный риск
  | 'THEFT_SUSPECT'; // взял и не вернул + подозрение

export const BEHAVIOR_PATTERNS = {
  LIST: 'behavior.list',
  GET: 'behavior.get',
};

/** Сессия визита покупателя (агрегат поведения). */
export interface BehaviorSessionView {
  id: string;
  trackingId: string;
  storeId: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null; // секунды
  active: boolean;
  visitedCameras: string[];
  productsTaken: number;
  productsReturned: number;
  riskScore: number; // 0..100
  behaviorType: BehaviorType;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListBehaviorDto {
  ownerId: string;
  storeId?: string;
  behaviorType?: string;
  minRiskScore?: number;
  maxRiskScore?: number;
  active?: boolean;
  from?: string; // ISO — по startedAt
  to?: string;
  limit?: number;
}

// ---- Purchase Matching Engine (Этап 14.4) ----

export type PurchaseStatus = 'MATCHED' | 'PARTIAL_MATCH' | 'NOT_MATCHED';

export const PURCHASE_PATTERNS = {
  LIST: 'purchase.list',
  GET: 'purchase.get',
};

/** Сопоставление AI-товаров с чеком кассы. */
export interface PurchaseSessionView {
  id: string;
  trackingId: string | null;
  storeId: string;
  checkoutId: string | null;
  receiptId: string | null;
  status: PurchaseStatus;
  confidence: number; // 0..100
  aiProducts: string[];
  receiptProducts: string[];
  missingProducts: string[]; // AI видел, нет в чеке (потенц. кража)
  extraProducts: string[]; // в чеке, AI не видел
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListPurchasesDto {
  ownerId: string;
  storeId?: string;
  checkoutId?: string;
  status?: string;
  minConfidence?: number;
  maxConfidence?: number;
  from?: string; // ISO — по createdAt
  to?: string;
  limit?: number;
}

// ---- Alert Engine (Этап 14.5) ----

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const ALERT_PATTERNS = {
  LIST: 'alert.list',
  GET: 'alert.get',
};

/** Финальное решение о тревоге (объединяет Behavior + Purchase). */
export interface AlertDecisionView {
  id: string;
  trackingId: string | null;
  storeId: string;
  alertType: string; // THEFT_ALERT | SUSPICIOUS | CAMERA_OFFLINE
  severity: AlertSeverity;
  decision: string; // код причины
  riskScore: number | null;
  confidence: number | null;
  behaviorSessionId: string | null;
  purchaseSessionId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListAlertsDto {
  ownerId: string;
  storeId?: string;
  severity?: string;
  alertType?: string;
  from?: string; // ISO — по createdAt
  to?: string;
  limit?: number;
}
