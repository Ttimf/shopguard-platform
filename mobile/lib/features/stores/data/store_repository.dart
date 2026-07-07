import '../../../core/api/dio_client.dart';
import '../../cameras/data/camera_models.dart';

/// Магазины владельца: список и детали.
///
/// Отдельного `GET /api/stores/:id` в backend нет — детали берутся из списка
/// (ответ `/api/stores` уже содержит все поля магазина).
class StoreRepository {
  final DioClient _client;
  StoreRepository(this._client);

  Future<List<StoreModel>> list() async {
    final res = await _client.dio.get('/stores');
    return (res.data as List)
        .map((e) => StoreModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Детали магазина по id (из списка). null — если не найден.
  Future<StoreModel?> getById(String id) async {
    for (final s in await list()) {
      if (s.id == id) return s;
    }
    return null;
  }
}
