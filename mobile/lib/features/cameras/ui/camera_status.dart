import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// Индикатор статуса камеры: ONLINE→зелёный, UNKNOWN→жёлтый, OFFLINE→красный.
Color cameraStatusColor(String status) => switch (status) {
      'ONLINE' => Colors.green,
      'OFFLINE' => AppColors.danger,
      _ => Colors.amber, // UNKNOWN / ещё не проверена
    };

String cameraStatusLabel(String status) => switch (status) {
      'ONLINE' => 'Онлайн',
      'OFFLINE' => 'Оффлайн',
      _ => 'Неизвестно',
    };

/// Короткая подсказка о проблеме для оффлайн/непроверенных камер.
String? cameraStatusHint(String status) => switch (status) {
      'OFFLINE' => 'Нет соединения с камерой (RTSP)',
      'UNKNOWN' => 'Статус не подтверждён — выполните проверку',
      _ => null,
    };
