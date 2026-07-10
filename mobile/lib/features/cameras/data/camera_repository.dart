import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../../../core/api/dio_client.dart';
import 'camera_models.dart';

/// Репозиторий камер: gateway /api/stores + /api/cameras.
class CameraRepository {
  final DioClient _client;
  CameraRepository(this._client);

  Future<List<StoreModel>> listStores() async {
    final res = await _client.dio.get('/stores');
    return (res.data as List)
        .map((e) => StoreModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<StoreModel> createStore(String name, String? address) async {
    final res = await _client.dio
        .post('/stores', data: {'name': name, 'address': address});
    return StoreModel.fromJson(res.data as Map<String, dynamic>);
  }

  /// Все камеры владельца.
  Future<List<CameraModel>> listCameras() async {
    final res = await _client.dio.get('/cameras');
    return (res.data as List)
        .map((e) => CameraModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Одна камера (свежие данные для детальной страницы).
  Future<CameraModel> getCamera(String id) async {
    final res = await _client.dio.get('/cameras/$id');
    return CameraModel.fromJson(res.data as Map<String, dynamic>);
  }

  Future<CameraModel> createCamera(Map<String, dynamic> payload) async {
    final res = await _client.dio.post('/cameras', data: payload);
    return CameraModel.fromJson(res.data as Map<String, dynamic>);
  }

  Future<CameraModel> updateCamera(
      String id, Map<String, dynamic> payload) async {
    final res = await _client.dio.patch('/cameras/$id', data: payload);
    return CameraModel.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> deleteCamera(String id) async {
    await _client.dio.delete('/cameras/$id');
  }

  Future<CameraTestResult> testCamera(String id) async {
    final res = await _client.dio.post('/cameras/$id/test');
    return CameraTestResult.fromJson(res.data as Map<String, dynamic>);
  }

  /// Снимок камеры (JPEG-байты).
  Future<Uint8List> snapshot(String id) async {
    final res = await _client.dio.get<List<int>>(
      '/cameras/$id/snapshot',
      options: Options(responseType: ResponseType.bytes),
    );
    return Uint8List.fromList(res.data!);
  }
}
