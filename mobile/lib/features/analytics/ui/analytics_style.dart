import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

/// Маппинг доменных статусов аналитики → цвет и подпись.
/// Значения enum — реальные из backend-контрактов (не выдуманные).

Color severityColor(String s) => switch (s.toUpperCase()) {
      'LOW' => Colors.green,
      'MEDIUM' => Colors.orange,
      'HIGH' => AppColors.danger,
      'CRITICAL' => const Color(0xFFB91C1C),
      _ => AppColors.textMuted,
    };

Color purchaseStatusColor(String s) => switch (s.toUpperCase()) {
      'MATCHED' => Colors.green,
      'PARTIAL_MATCH' => Colors.orange,
      'NOT_MATCHED' => AppColors.danger,
      _ => AppColors.textMuted,
    };

String purchaseStatusLabel(String s) => switch (s.toUpperCase()) {
      'MATCHED' => 'Совпало',
      'PARTIAL_MATCH' => 'Частично',
      'NOT_MATCHED' => 'Не совпало',
      _ => s,
    };

Color behaviorColor(String s) => switch (s.toUpperCase()) {
      'BROWSER' => AppColors.textMuted,
      'SHOPPER' => AppColors.primary,
      'SUSPICIOUS' => Colors.orange,
      'THEFT_SUSPECT' => AppColors.danger,
      _ => AppColors.textMuted,
    };

/// Риск 0..100 → цвет (низкий/средний/высокий).
Color riskColor(int score) {
  if (score >= 70) return AppColors.danger;
  if (score >= 40) return Colors.orange;
  return Colors.green;
}

/// Секунды → «5м 30с» / «45с».
String formatDuration(int? seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return '$secondsс';
  final m = seconds ~/ 60;
  final s = seconds % 60;
  return s == 0 ? '$mм' : '$mм $sс';
}
