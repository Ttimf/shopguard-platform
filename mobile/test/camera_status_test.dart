// Тесты логики статуса/AI камеры (Этап 15.4).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:shopguard_mobile/core/theme/app_theme.dart';
import 'package:shopguard_mobile/features/cameras/data/camera_models.dart';
import 'package:shopguard_mobile/features/cameras/ui/camera_status.dart';

CameraModel _cam({required String status, bool enabled = true}) => CameraModel(
      id: 'c1',
      storeId: 's1',
      name: 'Cam',
      rtspUrl: 'rtsp://x',
      enabled: enabled,
      status: status,
      fpsLimit: 15,
      hasPassword: false,
    );

void main() {
  test('cameraStatusColor: green/red/yellow', () {
    expect(cameraStatusColor('ONLINE'), Colors.green);
    expect(cameraStatusColor('OFFLINE'), AppColors.danger);
    expect(cameraStatusColor('UNKNOWN'), Colors.amber);
    expect(cameraStatusColor('что-то'), Colors.amber);
  });

  test('cameraStatusLabel', () {
    expect(cameraStatusLabel('ONLINE'), 'Онлайн');
    expect(cameraStatusLabel('OFFLINE'), 'Оффлайн');
    expect(cameraStatusLabel('UNKNOWN'), 'Неизвестно');
  });

  test('cameraStatusHint: только для offline/unknown', () {
    expect(cameraStatusHint('ONLINE'), isNull);
    expect(cameraStatusHint('OFFLINE'), isNotNull);
    expect(cameraStatusHint('UNKNOWN'), isNotNull);
  });

  test('aiRunning: включена И онлайн', () {
    expect(_cam(status: 'ONLINE', enabled: true).aiRunning, true);
    expect(_cam(status: 'ONLINE', enabled: false).aiRunning, false);
    expect(_cam(status: 'OFFLINE', enabled: true).aiRunning, false);
    expect(_cam(status: 'UNKNOWN', enabled: true).aiRunning, false);
  });
}
