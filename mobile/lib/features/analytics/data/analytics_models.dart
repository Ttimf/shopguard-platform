// DTO движков (Event/Tracking/Behavior/Purchase/Alert) + список AI-моделей.
// Только для чтения (GET-ответы). Enum-поля хранятся как String — неизвестные
// значения не роняют парсинг. Все fromJson устойчивы к null/отсутствию полей.

DateTime? _dt(Object? v) =>
    v is String ? DateTime.tryParse(v)?.toLocal() : null;

DateTime _dtReq(Object? v) =>
    _dt(v) ?? DateTime.fromMillisecondsSinceEpoch(0);

List<String> _strList(Object? v) =>
    v is List ? v.map((e) => e.toString()).toList() : const [];

Map<String, dynamic>? _map(Object? v) =>
    v is Map<String, dynamic> ? v : null;

int _int(Object? v, [int def = 0]) => v is num ? v.toInt() : def;

/// Событие Event Engine (EventLog).
class EngineEvent {
  final String eventId;
  final String storeId;
  final String? cameraId;
  final int? trackingId;
  final String eventType;
  final DateTime timestamp;
  final double? confidence;
  final String? modelVersion;
  final Map<String, dynamic>? metadata;

  EngineEvent({
    required this.eventId,
    required this.storeId,
    required this.eventType,
    required this.timestamp,
    this.cameraId,
    this.trackingId,
    this.confidence,
    this.modelVersion,
    this.metadata,
  });

  factory EngineEvent.fromJson(Map<String, dynamic> j) => EngineEvent(
        eventId: j['eventId'] as String,
        storeId: j['storeId'] as String,
        cameraId: j['cameraId'] as String?,
        trackingId: (j['trackingId'] as num?)?.toInt(),
        eventType: j['eventType'] as String? ?? 'Unknown',
        timestamp: _dtReq(j['timestamp']),
        confidence: (j['confidence'] as num?)?.toDouble(),
        modelVersion: j['modelVersion'] as String?,
        metadata: _map(j['metadata']),
      );
}

/// Сегмент маршрута человека (Tracking Engine).
class PersonTrack {
  final String id;
  final String trackingId;
  final String storeId;
  final String cameraId;
  final DateTime enteredAt;
  final DateTime? exitedAt;
  final int? duration;
  final bool active;
  final Map<String, dynamic>? metadata;

  PersonTrack({
    required this.id,
    required this.trackingId,
    required this.storeId,
    required this.cameraId,
    required this.enteredAt,
    required this.active,
    this.exitedAt,
    this.duration,
    this.metadata,
  });

  factory PersonTrack.fromJson(Map<String, dynamic> j) => PersonTrack(
        id: j['id'] as String,
        trackingId: j['trackingId']?.toString() ?? '',
        storeId: j['storeId'] as String,
        cameraId: j['cameraId'] as String? ?? '',
        enteredAt: _dtReq(j['enteredAt']),
        exitedAt: _dt(j['exitedAt']),
        duration: (j['duration'] as num?)?.toInt(),
        active: j['active'] as bool? ?? (j['exitedAt'] == null),
        metadata: _map(j['metadata']),
      );
}

/// Сессия поведения покупателя (Behavior Engine).
class BehaviorSession {
  final String id;
  final String trackingId;
  final String storeId;
  final DateTime startedAt;
  final DateTime? endedAt;
  final int? duration;
  final bool active;
  final List<String> visitedCameras;
  final int productsTaken;
  final int productsReturned;
  final int riskScore;
  final String behaviorType;
  final Map<String, dynamic>? metadata;

  BehaviorSession({
    required this.id,
    required this.trackingId,
    required this.storeId,
    required this.startedAt,
    required this.active,
    required this.visitedCameras,
    required this.productsTaken,
    required this.productsReturned,
    required this.riskScore,
    required this.behaviorType,
    this.endedAt,
    this.duration,
    this.metadata,
  });

  factory BehaviorSession.fromJson(Map<String, dynamic> j) => BehaviorSession(
        id: j['id'] as String,
        trackingId: j['trackingId']?.toString() ?? '',
        storeId: j['storeId'] as String,
        startedAt: _dtReq(j['startedAt']),
        endedAt: _dt(j['endedAt']),
        duration: (j['duration'] as num?)?.toInt(),
        active: j['active'] as bool? ?? (j['endedAt'] == null),
        visitedCameras: _strList(j['visitedCameras']),
        productsTaken: _int(j['productsTaken']),
        productsReturned: _int(j['productsReturned']),
        riskScore: _int(j['riskScore']),
        behaviorType: j['behaviorType'] as String? ?? 'BROWSER',
        metadata: _map(j['metadata']),
      );
}

/// Сопоставление покупки (Purchase Engine).
class PurchaseSession {
  final String id;
  final String? trackingId;
  final String storeId;
  final String? checkoutId;
  final String? receiptId;
  final String status; // MATCHED | PARTIAL_MATCH | NOT_MATCHED
  final int confidence;
  final List<String> aiProducts;
  final List<String> receiptProducts;
  final List<String> missingProducts;
  final List<String> extraProducts;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;

  PurchaseSession({
    required this.id,
    required this.storeId,
    required this.status,
    required this.confidence,
    required this.aiProducts,
    required this.receiptProducts,
    required this.missingProducts,
    required this.extraProducts,
    required this.createdAt,
    this.trackingId,
    this.checkoutId,
    this.receiptId,
    this.metadata,
  });

  factory PurchaseSession.fromJson(Map<String, dynamic> j) => PurchaseSession(
        id: j['id'] as String,
        trackingId: j['trackingId']?.toString(),
        storeId: j['storeId'] as String,
        checkoutId: j['checkoutId'] as String?,
        receiptId: j['receiptId'] as String?,
        status: j['status'] as String? ?? 'NOT_MATCHED',
        confidence: _int(j['confidence']),
        aiProducts: _strList(j['aiProducts']),
        receiptProducts: _strList(j['receiptProducts']),
        missingProducts: _strList(j['missingProducts']),
        extraProducts: _strList(j['extraProducts']),
        metadata: _map(j['metadata']),
        createdAt: _dtReq(j['createdAt']),
      );
}

/// Решение о тревоге (Alert Engine).
class AlertDecision {
  final String id;
  final String? trackingId;
  final String storeId;
  final String alertType;
  final String severity;
  final String decision;
  final int? riskScore;
  final int? confidence;
  final String? behaviorSessionId;
  final String? purchaseSessionId;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;

  AlertDecision({
    required this.id,
    required this.storeId,
    required this.alertType,
    required this.severity,
    required this.decision,
    required this.createdAt,
    this.trackingId,
    this.riskScore,
    this.confidence,
    this.behaviorSessionId,
    this.purchaseSessionId,
    this.metadata,
  });

  factory AlertDecision.fromJson(Map<String, dynamic> j) => AlertDecision(
        id: j['id'] as String,
        trackingId: j['trackingId']?.toString(),
        storeId: j['storeId'] as String,
        alertType: j['alertType'] as String? ?? 'UNKNOWN',
        severity: j['severity'] as String? ?? 'LOW',
        decision: j['decision'] as String? ?? '',
        riskScore: (j['riskScore'] as num?)?.toInt(),
        confidence: (j['confidence'] as num?)?.toInt(),
        behaviorSessionId: j['behaviorSessionId'] as String?,
        purchaseSessionId: j['purchaseSessionId'] as String?,
        metadata: _map(j['metadata']),
        createdAt: _dtReq(j['createdAt']),
      );
}

/// Доступные AI-модели (GET /api/models).
class AiModelsInfo {
  final List<String> available;
  final String? defaultModel;

  AiModelsInfo({required this.available, this.defaultModel});

  factory AiModelsInfo.fromJson(Map<String, dynamic> j) => AiModelsInfo(
        available: _strList(j['available']),
        defaultModel: j['default'] as String?,
      );
}
