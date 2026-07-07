import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';

import '../data/auth_models.dart';
import '../data/auth_repository.dart';

// ---- Состояния ----
enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState extends Equatable {
  final AuthStatus status;
  final AuthUser? user;
  final bool loading;
  final String? error;

  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.loading = false,
    this.error,
  });

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? loading,
    String? error,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
        loading: loading ?? this.loading,
        error: error,
      );

  @override
  List<Object?> get props => [status, user, loading, error];
}

// ---- Cubit ----
class AuthCubit extends Cubit<AuthState> {
  final AuthRepository _repo;

  AuthCubit(this._repo) : super(const AuthState()) {
    // истечение сессии из API-слоя → выход в логин
    _repo.onSessionExpired = () {
      if (!isClosed) {
        emit(const AuthState(status: AuthStatus.unauthenticated));
      }
    };
  }

  Future<void> appStarted() async {
    final user = await _repo.tryRestore();
    emit(AuthState(
      status: user != null
          ? AuthStatus.authenticated
          : AuthStatus.unauthenticated,
      user: user,
    ));
  }

  Future<void> login(String email, String password) =>
      _run(() => _repo.login(email, password));

  Future<void> register(String email, String password, String? name) =>
      _run(() => _repo.register(email, password, name));

  Future<void> logout() async {
    await _repo.logout();
    emit(const AuthState(status: AuthStatus.unauthenticated));
  }

  Future<void> _run(Future<AuthUser> Function() action) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      final user = await action();
      emit(AuthState(status: AuthStatus.authenticated, user: user));
    } on DioException catch (e) {
      final msg = e.response?.data is Map
          ? (e.response!.data['message']?.toString() ?? 'Ошибка')
          : 'Нет связи с сервером';
      emit(state.copyWith(loading: false, error: msg));
    } catch (_) {
      emit(state.copyWith(loading: false, error: 'Ошибка'));
    }
  }
}
