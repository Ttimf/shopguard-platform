// Unit-тесты моделей ShopGuard (парсинг ответов API).
import 'package:flutter_test/flutter_test.dart';

import 'package:shopguard_mobile/features/auth/data/auth_models.dart';
import 'package:shopguard_mobile/features/alerts/data/event_model.dart';
import 'package:shopguard_mobile/features/cameras/data/camera_models.dart';

void main() {
  test('AuthResult.fromJson парсит токены и пользователя', () {
    final r = AuthResult.fromJson({
      'accessToken': 'a',
      'refreshToken': 'r',
      'user': {'id': '1', 'email': 'x@t.com', 'name': null, 'role': 'OWNER'},
    });
    expect(r.accessToken, 'a');
    expect(r.refreshToken, 'r');
    expect(r.user.email, 'x@t.com');
    expect(r.user.role, 'OWNER');
  });

  test('AlertEvent.fromJson: THEFT + время', () {
    final e = AlertEvent.fromJson({
      'id': 'e1',
      'storeId': 's1',
      'cameraName': 'Касса',
      'type': 'THEFT',
      'confidence': 0.9,
      'status': 'NEW',
      'createdAt': '2026-07-06T10:00:00.000Z',
    });
    expect(e.isTheft, true);
    expect(e.cameraName, 'Касса');
    expect(e.confidence, 0.9);
  });

  test('AlertEvent.fromJson: устойчив к отсутствующим полям', () {
    final e = AlertEvent.fromJson({
      'id': 'e2',
      'storeId': 's1',
      'type': 'BLACKLIST',
      'createdAt': 'bad-date',
    });
    expect(e.isTheft, false);
    expect(e.cameraName, '—');
    expect(e.snapshotUrl, isNull);
  });

  test('CameraModel.fromJson: статус, пароль скрыт', () {
    final c = CameraModel.fromJson({
      'id': 'c1',
      'storeId': 's1',
      'name': 'Cam',
      'rtspUrl': 'rtsp://host/s',
      'username': 'admin',
      'hasPassword': true,
      'enabled': true,
      'status': 'ONLINE',
      'fpsLimit': 12,
      'resolution': '1920x1080',
    });
    expect(c.isOnline, true);
    expect(c.isOffline, false);
    expect(c.hasPassword, true);
    expect(c.username, 'admin');
    expect(c.resolution, '1920x1080');
  });

  test('CameraTestResult.fromJson', () {
    final t = CameraTestResult.fromJson({
      'online': false,
      'error': 'Timeout',
    });
    expect(t.online, false);
    expect(t.error, 'Timeout');
  });
}
