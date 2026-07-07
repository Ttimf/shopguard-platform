class AlertEvent {
  final String id;
  final String storeId;
  final String cameraName;
  final String type; // THEFT | BLACKLIST
  final String? personName;
  final double? confidence;
  final String? snapshotUrl; // presigned (из REST); у live-WS может быть null
  final String status; // NEW | REVIEWED | FALSE_ALARM
  final DateTime createdAt;

  AlertEvent({
    required this.id,
    required this.storeId,
    required this.cameraName,
    required this.type,
    required this.status,
    required this.createdAt,
    this.personName,
    this.confidence,
    this.snapshotUrl,
  });

  bool get isTheft => type == 'THEFT';

  factory AlertEvent.fromJson(Map<String, dynamic> j) => AlertEvent(
        id: j['id'] as String,
        storeId: j['storeId'] as String,
        cameraName: j['cameraName'] as String? ?? '—',
        type: j['type'] as String,
        personName: j['personName'] as String?,
        confidence: (j['confidence'] as num?)?.toDouble(),
        snapshotUrl: j['snapshotUrl'] as String?,
        status: j['status'] as String? ?? 'NEW',
        createdAt:
            DateTime.tryParse(j['createdAt'] as String? ?? '')?.toLocal() ??
                DateTime.now(),
      );

  AlertEvent copyWith({String? status}) => AlertEvent(
        id: id,
        storeId: storeId,
        cameraName: cameraName,
        type: type,
        status: status ?? this.status,
        createdAt: createdAt,
        personName: personName,
        confidence: confidence,
        snapshotUrl: snapshotUrl,
      );
}
