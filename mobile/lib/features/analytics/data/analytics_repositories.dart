import '../../../core/api/dio_client.dart';
import 'analytics_models.dart';

// Репозитории аналитических движков. Только чтение (GET).
// Все list-эндпоинты gateway возвращают массив View-объектов.
// Фильтры соответствуют Query DTO backend; null-значения не отправляются.

Map<String, dynamic> _q(Map<String, dynamic> raw) {
  final out = <String, dynamic>{};
  raw.forEach((k, v) {
    if (v != null) out[k] = v;
  });
  return out;
}

/// Event Engine — GET /api/events, /api/events/:id.
class EventsEngineRepository {
  final DioClient _client;
  EventsEngineRepository(this._client);

  Future<List<EngineEvent>> list({
    String? storeId,
    String? cameraId,
    String? eventType,
    String? from,
    String? to,
    int? limit,
  }) async {
    final res = await _client.dio.get('/events',
        queryParameters: _q({
          'storeId': storeId,
          'cameraId': cameraId,
          'eventType': eventType,
          'from': from,
          'to': to,
          'limit': limit,
        }));
    return (res.data as List)
        .map((e) => EngineEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<EngineEvent> getById(String id) async {
    final res = await _client.dio.get('/events/$id');
    return EngineEvent.fromJson(res.data as Map<String, dynamic>);
  }
}

/// Tracking Engine — GET /api/tracks, /api/tracks/:id.
class TrackingRepository {
  final DioClient _client;
  TrackingRepository(this._client);

  Future<List<PersonTrack>> list({
    String? storeId,
    String? cameraId,
    String? trackingId,
    bool? active,
    String? from,
    String? to,
    int? limit,
  }) async {
    final res = await _client.dio.get('/tracks',
        queryParameters: _q({
          'storeId': storeId,
          'cameraId': cameraId,
          'trackingId': trackingId,
          'active': active?.toString(),
          'from': from,
          'to': to,
          'limit': limit,
        }));
    return (res.data as List)
        .map((e) => PersonTrack.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<PersonTrack> getById(String id) async {
    final res = await _client.dio.get('/tracks/$id');
    return PersonTrack.fromJson(res.data as Map<String, dynamic>);
  }
}

/// Behavior Engine — GET /api/behavior, /api/behavior/:id.
class BehaviorRepository {
  final DioClient _client;
  BehaviorRepository(this._client);

  Future<List<BehaviorSession>> list({
    String? storeId,
    String? behaviorType,
    int? minRiskScore,
    int? maxRiskScore,
    bool? active,
    String? from,
    String? to,
    int? limit,
  }) async {
    final res = await _client.dio.get('/behavior',
        queryParameters: _q({
          'storeId': storeId,
          'behaviorType': behaviorType,
          'minRiskScore': minRiskScore,
          'maxRiskScore': maxRiskScore,
          'active': active?.toString(),
          'from': from,
          'to': to,
          'limit': limit,
        }));
    return (res.data as List)
        .map((e) => BehaviorSession.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<BehaviorSession> getById(String id) async {
    final res = await _client.dio.get('/behavior/$id');
    return BehaviorSession.fromJson(res.data as Map<String, dynamic>);
  }
}

/// Purchase Matching Engine — GET /api/purchases, /api/purchases/:id.
class PurchaseRepository {
  final DioClient _client;
  PurchaseRepository(this._client);

  Future<List<PurchaseSession>> list({
    String? storeId,
    String? checkoutId,
    String? status,
    int? minConfidence,
    int? maxConfidence,
    String? from,
    String? to,
    int? limit,
  }) async {
    final res = await _client.dio.get('/purchases',
        queryParameters: _q({
          'storeId': storeId,
          'checkoutId': checkoutId,
          'status': status,
          'minConfidence': minConfidence,
          'maxConfidence': maxConfidence,
          'from': from,
          'to': to,
          'limit': limit,
        }));
    return (res.data as List)
        .map((e) => PurchaseSession.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<PurchaseSession> getById(String id) async {
    final res = await _client.dio.get('/purchases/$id');
    return PurchaseSession.fromJson(res.data as Map<String, dynamic>);
  }
}

/// Alert Engine — GET /api/alerts, /api/alerts/:id.
class AlertDecisionsRepository {
  final DioClient _client;
  AlertDecisionsRepository(this._client);

  Future<List<AlertDecision>> list({
    String? storeId,
    String? severity,
    String? alertType,
    String? from,
    String? to,
    int? limit,
  }) async {
    final res = await _client.dio.get('/alerts',
        queryParameters: _q({
          'storeId': storeId,
          'severity': severity,
          'alertType': alertType,
          'from': from,
          'to': to,
          'limit': limit,
        }));
    return (res.data as List)
        .map((e) => AlertDecision.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AlertDecision> getById(String id) async {
    final res = await _client.dio.get('/alerts/$id');
    return AlertDecision.fromJson(res.data as Map<String, dynamic>);
  }
}

/// AI Models — GET /api/models (список + модель по умолчанию).
/// Отдельного GET /api/models/:id в backend нет.
class AiModelsRepository {
  final DioClient _client;
  AiModelsRepository(this._client);

  Future<AiModelsInfo> get() async {
    final res = await _client.dio.get('/models');
    return AiModelsInfo.fromJson(res.data as Map<String, dynamic>);
  }
}
