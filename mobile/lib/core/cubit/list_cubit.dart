import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../error/error_mapper.dart';

enum ListStatus { loading, success, error }

/// Обобщённое состояние списочного экрана (только чтение).
/// Переиспользуется всеми аналитическими экранами через [ListCubit].
class ListState<T> extends Equatable {
  final ListStatus status;
  final List<T> items;
  final String? error;

  const ListState._(this.status, this.items, this.error);

  const ListState.loading() : this._(ListStatus.loading, const [], null);
  const ListState.success(List<T> items)
      : this._(ListStatus.success, items, null);
  const ListState.failure(String error)
      : this._(ListStatus.error, const [], error);

  bool get isEmpty => status == ListStatus.success && items.isEmpty;

  @override
  List<Object?> get props => [status, items, error];
}

/// Обобщённый Cubit: выполняет переданный fetch и выставляет loading/success/error.
/// Один класс на все движки — без дублирования на каждый экран.
class ListCubit<T> extends Cubit<ListState<T>> {
  ListCubit() : super(ListState<T>.loading());

  Future<void> run(Future<List<T>> Function() fetch) async {
    emit(ListState<T>.loading());
    try {
      emit(ListState<T>.success(await fetch()));
    } catch (e) {
      emit(ListState<T>.failure(friendlyError(e)));
    }
  }
}
