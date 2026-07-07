import '../../../core/api/dio_client.dart';
import 'event_model.dart';

/// События магазина: список из gateway /api/stores/:id/events + смена статуса.
class EventsRepository {
  final DioClient _client;
  EventsRepository(this._client);

  /// Первый магазин владельца (для выбора по умолчанию). null — магазинов нет.
  Future<String?> firstStoreId() async {
    final res = await _client.dio.get('/stores');
    final list = res.data as List;
    return list.isEmpty ? null : (list.first as Map)['id'] as String;
  }

  Future<List<AlertEvent>> list(String storeId, {String? status}) async {
    final res = await _client.dio.get(
      '/stores/$storeId/events',
      queryParameters: status != null ? {'status': status} : null,
    );
    return (res.data as List)
        .map((e) => AlertEvent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AlertEvent> updateStatus(String eventId, String status) async {
    final res = await _client.dio
        .patch('/events/$eventId/status', data: {'status': status});
    return AlertEvent.fromJson(res.data as Map<String, dynamic>);
  }
}
