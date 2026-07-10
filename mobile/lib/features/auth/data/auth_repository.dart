import 'package:dio/dio.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/storage/token_storage.dart';
import 'auth_models.dart';

/// Репозиторий авторизации: общение с gateway /api/auth + хранение сессии.
class AuthRepository {
  final DioClient _client;
  final TokenStorage _storage;

  AuthRepository(this._client, this._storage);

  Dio get _dio => _client.dio;

  /// Хэндлер истечения сессии (refresh не удался) — для выхода в логин.
  set onSessionExpired(void Function() cb) => _client.onSessionExpired = cb;

  Future<AuthUser> register(String email, String password, String? name) async {
    final res = await _dio.post('/auth/register',
        data: {'email': email, 'password': password, 'name': name});
    final result = AuthResult.fromJson(res.data as Map<String, dynamic>);
    await _storage.save(result.accessToken, result.refreshToken);
    return result.user;
  }

  Future<AuthUser> login(String email, String password) async {
    final res = await _dio
        .post('/auth/login', data: {'email': email, 'password': password});
    final result = AuthResult.fromJson(res.data as Map<String, dynamic>);
    await _storage.save(result.accessToken, result.refreshToken);
    return result.user;
  }

  /// Автовосстановление сессии (без ввода пароля).
  Future<AuthUser?> tryRestore() async {
    final refresh = await _storage.refresh;
    if (refresh == null || refresh.isEmpty) return null;
    try {
      final res =
          await _dio.post('/auth/refresh', data: {'refreshToken': refresh});
      final data = res.data as Map<String, dynamic>;
      await _storage.save(
          data['accessToken'] as String, data['refreshToken'] as String);
      final me = await _dio.get('/auth/me');
      return AuthUser.fromJson(me.data as Map<String, dynamic>);
    } catch (_) {
      await _storage.clear();
      return null;
    }
  }

  /// Текущий пользователь (проверка действительности токена).
  Future<AuthUser> me() async {
    final res = await _dio.get('/auth/me');
    return AuthUser.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> logout() async {
    final refresh = await _storage.refresh;
    if (refresh != null) {
      try {
        await _dio.post('/auth/logout', data: {'refreshToken': refresh});
      } catch (_) {}
    }
    await _storage.clear();
  }
}
