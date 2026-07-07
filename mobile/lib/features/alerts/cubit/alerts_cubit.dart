import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../data/alerts_socket.dart';
import '../data/event_model.dart';
import '../data/events_repository.dart';

class AlertsState extends Equatable {
  final bool loading;
  final String? storeId;
  final List<AlertEvent> events;
  final String? error;

  const AlertsState({
    this.loading = false,
    this.storeId,
    this.events = const [],
    this.error,
  });

  AlertsState copyWith({
    bool? loading,
    String? storeId,
    List<AlertEvent>? events,
    String? error,
  }) =>
      AlertsState(
        loading: loading ?? this.loading,
        storeId: storeId ?? this.storeId,
        events: events ?? this.events,
        error: error,
      );

  @override
  List<Object?> get props => [loading, storeId, events, error];
}

class AlertsCubit extends Cubit<AlertsState> {
  final EventsRepository _repo;
  final AlertsSocket _socket;
  StreamSubscription? _sub;

  AlertsCubit(this._repo, this._socket) : super(const AlertsState());

  Future<void> load() async {
    emit(state.copyWith(loading: true, error: null));
    try {
      final storeId = await _repo.firstStoreId();
      if (storeId == null) {
        emit(const AlertsState());
        return;
      }
      final events = await _repo.list(storeId, status: 'NEW');
      emit(AlertsState(storeId: storeId, events: events));
      await _socket.connect(storeId);
      _sub ??= _socket.alerts.listen(_onLiveAlert);
    } catch (_) {
      emit(state.copyWith(loading: false, error: 'Не удалось загрузить'));
    }
  }

  void _onLiveAlert(AlertEvent e) {
    if (state.events.any((x) => x.id == e.id)) return;
    emit(state.copyWith(events: [e, ...state.events]));
  }

  /// Пометить событие (REVIEWED / FALSE_ALARM) — убираем из ленты новых.
  Future<void> setStatus(String id, String status) async {
    try {
      await _repo.updateStatus(id, status);
      emit(state.copyWith(
        events: state.events.where((e) => e.id != id).toList(),
      ));
    } catch (_) {
      emit(state.copyWith(error: 'Не удалось обновить статус'));
    }
  }

  @override
  Future<void> close() {
    _sub?.cancel();
    _socket.dispose();
    return super.close();
  }
}
