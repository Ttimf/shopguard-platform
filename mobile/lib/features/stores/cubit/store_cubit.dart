import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/error/error_mapper.dart';
import '../../analytics/data/analytics_repositories.dart';
import '../../cameras/data/camera_repository.dart';
import '../data/store_repository.dart';
import '../../cameras/data/camera_models.dart';

enum StoreStatus { loading, success, error }

class StoreState extends Equatable {
  final StoreStatus status;
  final StoreModel? store; // null — магазина ещё нет
  final int cameraCount;
  final int onlineCount;
  final String? aiDefault; // модель по умолчанию (GET /api/models)
  final String? error;

  const StoreState({
    this.status = StoreStatus.loading,
    this.store,
    this.cameraCount = 0,
    this.onlineCount = 0,
    this.aiDefault,
    this.error,
  });

  /// Эффективная модель AI магазина: override магазина или дефолт.
  String? get effectiveModel => store?.modelOverride ?? aiDefault;
  bool get usesOverride => store?.modelOverride != null;

  @override
  List<Object?> get props =>
      [status, store, cameraCount, onlineCount, aiDefault, error];
}

/// Данные магазина владельца. Переиспользует StoreRepository (магазин),
/// CameraRepository (число камер), AiModelsRepository (модель по умолчанию).
class StoreCubit extends Cubit<StoreState> {
  final StoreRepository _stores;
  final CameraRepository _cameras;
  final AiModelsRepository _models;

  StoreCubit(this._stores, this._cameras, this._models)
      : super(const StoreState());

  Future<void> load() async {
    emit(const StoreState(status: StoreStatus.loading));
    try {
      final stores = await _stores.list();
      if (stores.isEmpty) {
        emit(const StoreState(status: StoreStatus.success));
        return;
      }
      final store = stores.first;
      final cams = await _cameras.listCameras();
      final mine = cams.where((c) => c.storeId == store.id).toList();
      final models = await _models.get();
      emit(StoreState(
        status: StoreStatus.success,
        store: store,
        cameraCount: mine.length,
        onlineCount: mine.where((c) => c.isOnline).length,
        aiDefault: models.defaultModel,
      ));
    } catch (e) {
      emit(StoreState(status: StoreStatus.error, error: friendlyError(e)));
    }
  }
}
