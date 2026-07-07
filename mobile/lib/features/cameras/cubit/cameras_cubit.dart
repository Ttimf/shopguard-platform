import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../data/camera_models.dart';
import '../data/camera_repository.dart';

enum CameraFilter { all, online, offline }

class CamerasState extends Equatable {
  final bool loading;
  final List<StoreModel> stores;
  final List<CameraModel> cameras;
  final String search;
  final CameraFilter filter;
  final String? busyId; // камера в процессе действия (тест/переключение)
  final String? error;

  const CamerasState({
    this.loading = false,
    this.stores = const [],
    this.cameras = const [],
    this.search = '',
    this.filter = CameraFilter.all,
    this.busyId,
    this.error,
  });

  StoreModel? get firstStore => stores.isNotEmpty ? stores.first : null;

  List<CameraModel> get visible {
    final q = search.trim().toLowerCase();
    return cameras.where((c) {
      final byFilter = switch (filter) {
        CameraFilter.all => true,
        CameraFilter.online => c.isOnline,
        CameraFilter.offline => !c.isOnline,
      };
      final byQuery = q.isEmpty ||
          c.name.toLowerCase().contains(q) ||
          (c.location?.toLowerCase().contains(q) ?? false);
      return byFilter && byQuery;
    }).toList();
  }

  CamerasState copyWith({
    bool? loading,
    List<StoreModel>? stores,
    List<CameraModel>? cameras,
    String? search,
    CameraFilter? filter,
    String? busyId,
    bool clearBusy = false,
    String? error,
  }) =>
      CamerasState(
        loading: loading ?? this.loading,
        stores: stores ?? this.stores,
        cameras: cameras ?? this.cameras,
        search: search ?? this.search,
        filter: filter ?? this.filter,
        busyId: clearBusy ? null : (busyId ?? this.busyId),
        error: error,
      );

  @override
  List<Object?> get props =>
      [loading, stores, cameras, search, filter, busyId, error];
}

class CamerasCubit extends Cubit<CamerasState> {
  final CameraRepository _repo;
  CamerasCubit(this._repo) : super(const CamerasState());

  Future<void> load() async {
    emit(state.copyWith(loading: true, error: null));
    try {
      final stores = await _repo.listStores();
      final cameras =
          stores.isNotEmpty ? await _repo.listCameras() : <CameraModel>[];
      emit(state.copyWith(loading: false, stores: stores, cameras: cameras));
    } catch (_) {
      emit(state.copyWith(loading: false, error: 'Не удалось загрузить'));
    }
  }

  void setSearch(String q) => emit(state.copyWith(search: q));
  void setFilter(CameraFilter f) => emit(state.copyWith(filter: f));

  Future<void> _reload() async {
    final cameras = await _repo.listCameras();
    emit(state.copyWith(cameras: cameras));
  }

  Future<bool> createStore(String name, String? address) async {
    try {
      await _repo.createStore(name, address);
      await load();
      return true;
    } catch (_) {
      emit(state.copyWith(error: 'Не удалось создать магазин'));
      return false;
    }
  }

  Future<bool> addCamera(Map<String, dynamic> payload) async {
    final store = state.firstStore;
    if (store == null) return false;
    try {
      await _repo.createCamera({'storeId': store.id, ...payload});
      await _reload();
      return true;
    } catch (_) {
      emit(state.copyWith(error: 'Не удалось добавить камеру'));
      return false;
    }
  }

  Future<bool> updateCamera(String id, Map<String, dynamic> payload) async {
    try {
      await _repo.updateCamera(id, payload);
      await _reload();
      return true;
    } catch (_) {
      emit(state.copyWith(error: 'Не удалось сохранить'));
      return false;
    }
  }

  Future<void> deleteCamera(String id) async {
    await _repo.deleteCamera(id);
    await _reload();
  }

  Future<void> toggleEnabled(CameraModel cam) async {
    emit(state.copyWith(busyId: cam.id));
    try {
      await _repo.updateCamera(cam.id, {'enabled': !cam.enabled});
      await _reload();
    } finally {
      emit(state.copyWith(clearBusy: true));
    }
  }

  /// Проверка соединения. Возвращает результат и обновляет статус в списке.
  Future<CameraTestResult?> testCamera(String id) async {
    emit(state.copyWith(busyId: id));
    try {
      final result = await _repo.testCamera(id);
      await _reload();
      return result;
    } catch (_) {
      emit(state.copyWith(error: 'Не удалось проверить камеру'));
      return null;
    } finally {
      emit(state.copyWith(clearBusy: true));
    }
  }
}
