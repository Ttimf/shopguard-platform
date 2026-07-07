import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Безопасное хранение токенов сессии на устройстве.
class TokenStorage {
  static const _storage = FlutterSecureStorage();
  static const _kAccess = 'sg_access';
  static const _kRefresh = 'sg_refresh';

  Future<void> save(String access, String refresh) async {
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
  }

  Future<String?> get access => _storage.read(key: _kAccess);
  Future<String?> get refresh => _storage.read(key: _kRefresh);

  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
  }
}
