import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/storage/token_storage.dart';
import '../../analytics/data/analytics_repositories.dart';
import '../../auth/data/auth_repository.dart';
import '../../cameras/data/camera_repository.dart';

class DiagnosticsState extends Equatable {
  final bool running;
  final bool backendReachable; // /health ответил
  final bool apiResponds; // /health вернул status:ok
  final bool authActive; // есть токен сессии
  final bool tokenValid; // /auth/me успешен
  final int? cameraCount; // null — проверка не удалась
  final int? modelCount;
  final DateTime? ranAt;

  const DiagnosticsState({
    this.running = false,
    this.backendReachable = false,
    this.apiResponds = false,
    this.authActive = false,
    this.tokenValid = false,
    this.cameraCount,
    this.modelCount,
    this.ranAt,
  });

  @override
  List<Object?> get props => [
        running,
        backendReachable,
        apiResponds,
        authActive,
        tokenValid,
        cameraCount,
        modelCount,
        ranAt,
      ];
}

/// Диагностика системы. Использует только существующие API:
/// GET /health, GET /auth/me, GET /cameras, GET /models. Новых endpoint нет.
class DiagnosticsCubit extends Cubit<DiagnosticsState> {
  final DioClient _client;
  final AuthRepository _auth;
  final CameraRepository _cameras;
  final AiModelsRepository _models;
  final TokenStorage _storage;

  DiagnosticsCubit(
    this._client,
    this._auth,
    this._cameras,
    this._models,
    this._storage,
  ) : super(const DiagnosticsState());

  Future<void> run() async {
    emit(const DiagnosticsState(running: true));

    var backend = false;
    var api = false;
    try {
      final res = await _client.dio.get('/health');
      backend = true;
      api = (res.data is Map) && (res.data['status'] == 'ok');
    } catch (_) {}

    final token = await _storage.access;
    final authActive = token != null && token.isNotEmpty;

    var tokenValid = false;
    try {
      await _auth.me();
      tokenValid = true;
    } catch (_) {}

    int? cameras;
    try {
      cameras = (await _cameras.listCameras()).length;
    } catch (_) {}

    int? models;
    try {
      models = (await _models.get()).available.length;
    } catch (_) {}

    emit(DiagnosticsState(
      running: false,
      backendReachable: backend,
      apiResponds: api,
      authActive: authActive,
      tokenValid: tokenValid,
      cameraCount: cameras,
      modelCount: models,
      ranAt: DateTime.now(),
    ));
  }
}
