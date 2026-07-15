import 'dart:async';

import 'package:dio/dio.dart';

import '../storage/token_storage.dart';

/// Базовый адрес API (gateway). Переопределяется при сборке:
/// --dart-define=API_URL=http://IP:8080/api
const String apiBaseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://api.shopguardapp.net/api',
);

/// Dio с базовым адресом, подстановкой access-токена и автообновлением по 401.
///
/// При 401 однократно обновляет пару токенов через /auth/refresh (с ротацией)
/// и повторяет запрос. При неудаче — чистит сессию и вызывает [onSessionExpired].
class DioClient {
  final Dio dio;
  final TokenStorage _storage;
  final Dio _refreshDio; // без интерсепторов — чтобы не зациклиться
  Completer<bool>? _refreshing; // защита от параллельных refresh

  /// Вызывается, когда сессия истекла (refresh не удался) — для выхода в логин.
  void Function()? onSessionExpired;

  DioClient(this._storage)
      : dio = Dio(_baseOptions()),
        _refreshDio = Dio(_baseOptions()) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.access;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (e, handler) async {
          if (await _shouldRefresh(e)) {
            final refreshed = await _refreshToken();
            if (refreshed) {
              try {
                handler.resolve(await _retry(e.requestOptions));
                return;
              } catch (_) {
                // повтор не удался — пробрасываем исходную ошибку ниже
              }
            } else {
              onSessionExpired?.call();
            }
          }
          handler.next(e);
        },
      ),
    );
  }

  static BaseOptions _baseOptions() => BaseOptions(
        baseUrl: apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
      );

  Future<bool> _shouldRefresh(DioException e) async {
    final req = e.requestOptions;
    final isAuth = req.path.contains('/auth/');
    return e.response?.statusCode == 401 &&
        req.extra['retried'] != true &&
        !isAuth;
  }

  Future<Response<dynamic>> _retry(RequestOptions req) {
    req.extra['retried'] = true;
    return dio.fetch(req); // токен добавит onRequest (уже обновлённый)
  }

  /// Обновляет токены. Параллельные вызовы ждут один общий refresh.
  Future<bool> _refreshToken() {
    final inFlight = _refreshing;
    if (inFlight != null) return inFlight.future;
    final completer = Completer<bool>();
    _refreshing = completer;
    _doRefresh().then((ok) {
      _refreshing = null;
      completer.complete(ok);
    });
    return completer.future;
  }

  Future<bool> _doRefresh() async {
    final refresh = await _storage.refresh;
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final res = await _refreshDio.post(
        '/auth/refresh',
        data: {'refreshToken': refresh},
      );
      final data = res.data as Map<String, dynamic>;
      await _storage.save(
        data['accessToken'] as String,
        data['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      await _storage.clear();
      return false;
    }
  }
}
