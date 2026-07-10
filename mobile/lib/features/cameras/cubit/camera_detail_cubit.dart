import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/error_mapper.dart';
import '../../analytics/data/analytics_models.dart';
import '../../analytics/data/analytics_repositories.dart';
import '../../stores/data/store_repository.dart';
import '../data/camera_models.dart';
import '../data/camera_repository.dart';

enum DetailStatus { loading, success, error }

class CameraDetailState extends Equatable {
  final DetailStatus status;
  final CameraModel? camera;
  final String? aiModel; // модель AI магазина (override) или default
  final EngineEvent? lastActivity;
  final List<EngineEvent> errorEvents; // история CameraOffline
  final bool testing;
  final CameraTestResult? testResult;
  final String? testError;
  final String? error;

  const CameraDetailState({
    this.status = DetailStatus.loading,
    this.camera,
    this.aiModel,
    this.lastActivity,
    this.errorEvents = const [],
    this.testing = false,
    this.testResult,
    this.testError,
    this.error,
  });

  CameraDetailState copyWith({
    DetailStatus? status,
    CameraModel? camera,
    String? aiModel,
    EngineEvent? lastActivity,
    List<EngineEvent>? errorEvents,
    bool? testing,
    CameraTestResult? testResult,
    String? testError,
    bool clearTest = false,
    String? error,
  }) =>
      CameraDetailState(
        status: status ?? this.status,
        camera: camera ?? this.camera,
        aiModel: aiModel ?? this.aiModel,
        lastActivity: lastActivity ?? this.lastActivity,
        errorEvents: errorEvents ?? this.errorEvents,
        testing: testing ?? this.testing,
        testResult: clearTest ? null : (testResult ?? this.testResult),
        testError: clearTest ? null : (testError ?? this.testError),
        error: error,
      );

  @override
  List<Object?> get props => [
        status,
        camera,
        aiModel,
        lastActivity,
        errorEvents,
        testing,
        testResult,
        testError,
        error,
      ];
}

/// Детали одной камеры. Переиспользует существующие репозитории:
/// CameraRepository (камера + тест), EventsEngineRepository (активность/ошибки),
/// StoreRepository + AiModelsRepository (модель AI). Новых DioClient нет.
class CameraDetailCubit extends Cubit<CameraDetailState> {
  final CameraRepository _cameras;
  final EventsEngineRepository _events;
  final StoreRepository _stores;
  final AiModelsRepository _models;
  final String cameraId;

  CameraDetailCubit(
    this._cameras,
    this._events,
    this._stores,
    this._models,
    this.cameraId, {
    CameraModel? initial,
  }) : super(CameraDetailState(
          status: initial == null ? DetailStatus.loading : DetailStatus.success,
          camera: initial,
        ));

  Future<void> load() async {
    emit(state.copyWith(status: DetailStatus.loading, error: null));
    try {
      final camera = await _cameras.getCamera(cameraId);
      // параллельно: события камеры, магазин (модель), список моделей
      final results = await Future.wait([
        _events.list(cameraId: cameraId, limit: 100),
        _stores.getById(camera.storeId),
        _models.get(),
      ]);
      final events = (results[0] as List<EngineEvent>)
        ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
      final store = results[1] as StoreModel?;
      final models = results[2] as AiModelsInfo;

      emit(state.copyWith(
        status: DetailStatus.success,
        camera: camera,
        aiModel: store?.modelOverride ?? models.defaultModel,
        lastActivity: events.isNotEmpty ? events.first : null,
        errorEvents:
            events.where((e) => e.eventType == 'CameraOffline').take(10).toList(),
      ));
    } catch (e) {
      emit(state.copyWith(status: DetailStatus.error, error: friendlyError(e)));
    }
  }

  /// Проверка соединения. Обновляет статус камеры после теста.
  Future<void> runTest() async {
    emit(state.copyWith(testing: true, clearTest: true));
    try {
      final result = await _cameras.testCamera(cameraId);
      final camera = await _cameras.getCamera(cameraId); // свежий статус
      emit(state.copyWith(
          testing: false, testResult: result, camera: camera));
    } catch (e) {
      emit(state.copyWith(testing: false, testError: friendlyError(e)));
    }
  }
}
