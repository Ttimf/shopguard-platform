// Unit-тесты DTO аналитических движков (парсинг ответов API, Этап 15.2).
import 'package:flutter_test/flutter_test.dart';

import 'package:shopguard_mobile/features/analytics/data/analytics_models.dart';
import 'package:shopguard_mobile/features/cameras/data/camera_models.dart';

void main() {
  test('EngineEvent.fromJson: полный объект', () {
    final e = EngineEvent.fromJson({
      'eventId': 'ev1',
      'storeId': 's1',
      'cameraId': 'c1',
      'trackingId': 42,
      'eventType': 'PersonDetected',
      'timestamp': '2026-07-06T10:00:00.000Z',
      'confidence': 0.87,
      'modelVersion': 'yolov8n',
      'metadata': {'zone': 'entrance'},
    });
    expect(e.eventId, 'ev1');
    expect(e.trackingId, 42);
    expect(e.eventType, 'PersonDetected');
    expect(e.confidence, 0.87);
    expect(e.metadata?['zone'], 'entrance');
  });

  test('EngineEvent.fromJson: устойчив к null/отсутствию полей', () {
    final e = EngineEvent.fromJson({
      'eventId': 'ev2',
      'storeId': 's1',
      'timestamp': 'bad-date',
    });
    expect(e.cameraId, isNull);
    expect(e.trackingId, isNull);
    expect(e.eventType, 'Unknown');
    expect(e.confidence, isNull);
    expect(e.metadata, isNull);
    // некорректная дата -> эпоха, без исключения
    expect(e.timestamp.millisecondsSinceEpoch, 0);
  });

  test('PersonTrack.fromJson: active выводится из exitedAt', () {
    final open = PersonTrack.fromJson({
      'id': 't1',
      'trackingId': '7',
      'storeId': 's1',
      'cameraId': 'c1',
      'enteredAt': '2026-07-06T10:00:00.000Z',
      'exitedAt': null,
    });
    expect(open.active, true);
    expect(open.exitedAt, isNull);

    final closed = PersonTrack.fromJson({
      'id': 't2',
      'trackingId': '7',
      'storeId': 's1',
      'cameraId': 'c1',
      'enteredAt': '2026-07-06T10:00:00.000Z',
      'exitedAt': '2026-07-06T10:05:00.000Z',
      'duration': 300,
      'active': false,
    });
    expect(closed.active, false);
    expect(closed.duration, 300);
  });

  test('BehaviorSession.fromJson: списки и числа, дефолты', () {
    final b = BehaviorSession.fromJson({
      'id': 'b1',
      'trackingId': '9',
      'storeId': 's1',
      'startedAt': '2026-07-06T10:00:00.000Z',
      'endedAt': null,
      'visitedCameras': ['c1', 'c2'],
      'productsTaken': 3,
      'productsReturned': 1,
      'riskScore': 55,
      'behaviorType': 'SUSPICIOUS',
    });
    expect(b.active, true);
    expect(b.visitedCameras, ['c1', 'c2']);
    expect(b.riskScore, 55);
    expect(b.behaviorType, 'SUSPICIOUS');

    // отсутствующие поля -> безопасные дефолты
    final b2 = BehaviorSession.fromJson({
      'id': 'b2',
      'trackingId': '9',
      'storeId': 's1',
      'startedAt': '2026-07-06T10:00:00.000Z',
    });
    expect(b2.visitedCameras, isEmpty);
    expect(b2.productsTaken, 0);
    expect(b2.riskScore, 0);
    expect(b2.behaviorType, 'BROWSER');
  });

  test('PurchaseSession.fromJson: статусы и списки товаров', () {
    final p = PurchaseSession.fromJson({
      'id': 'p1',
      'trackingId': null,
      'storeId': 's1',
      'checkoutId': 'ch1',
      'receiptId': 'r1',
      'status': 'PARTIAL_MATCH',
      'confidence': 72,
      'aiProducts': ['milk', 'bread'],
      'receiptProducts': ['milk'],
      'missingProducts': ['bread'],
      'extraProducts': [],
      'createdAt': '2026-07-06T10:00:00.000Z',
    });
    expect(p.status, 'PARTIAL_MATCH');
    expect(p.confidence, 72);
    expect(p.missingProducts, ['bread']);
    expect(p.trackingId, isNull);

    // неизвестный статус сохраняется как строка (forward-compat)
    final p2 = PurchaseSession.fromJson({
      'id': 'p2',
      'storeId': 's1',
      'status': 'FUTURE_STATUS',
      'createdAt': '2026-07-06T10:00:00.000Z',
    });
    expect(p2.status, 'FUTURE_STATUS');
    expect(p2.aiProducts, isEmpty);
  });

  test('AlertDecision.fromJson: nullable riskScore/confidence', () {
    final a = AlertDecision.fromJson({
      'id': 'a1',
      'trackingId': '9',
      'storeId': 's1',
      'alertType': 'THEFT_ALERT',
      'severity': 'HIGH',
      'decision': 'BEHAVIOR_AND_MISMATCH',
      'riskScore': 80,
      'confidence': 65,
      'behaviorSessionId': 'b1',
      'purchaseSessionId': 'p1',
      'createdAt': '2026-07-06T10:00:00.000Z',
    });
    expect(a.alertType, 'THEFT_ALERT');
    expect(a.severity, 'HIGH');
    expect(a.riskScore, 80);

    final a2 = AlertDecision.fromJson({
      'id': 'a2',
      'storeId': 's1',
      'createdAt': '2026-07-06T10:00:00.000Z',
    });
    expect(a2.riskScore, isNull);
    expect(a2.confidence, isNull);
    expect(a2.alertType, 'UNKNOWN');
    expect(a2.severity, 'LOW');
  });

  test('AiModelsInfo.fromJson: available + default', () {
    final m = AiModelsInfo.fromJson({
      'available': ['yolov8n', 'yolov8s'],
      'default': 'yolov8n',
    });
    expect(m.available, ['yolov8n', 'yolov8s']);
    expect(m.defaultModel, 'yolov8n');

    final empty = AiModelsInfo.fromJson({});
    expect(empty.available, isEmpty);
    expect(empty.defaultModel, isNull);
  });

  test('StoreModel.fromJson: расширенные поля и nullable', () {
    final s = StoreModel.fromJson({
      'id': 's1',
      'name': 'Магазин №1',
      'address': 'ул. Ленина, 1',
      'telegramChatId': '12345',
      'modelOverride': 'yolov8s',
      'createdAt': '2026-07-06T10:00:00.000Z',
    });
    expect(s.name, 'Магазин №1');
    expect(s.telegramChatId, '12345');
    expect(s.modelOverride, 'yolov8s');
    expect(s.createdAt, isNotNull);

    final s2 = StoreModel.fromJson({'id': 's2', 'name': 'X'});
    expect(s2.address, isNull);
    expect(s2.telegramChatId, isNull);
    expect(s2.createdAt, isNull);
  });
}
