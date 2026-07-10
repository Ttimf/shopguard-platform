// Тесты чистой логики UI-слоя аналитики (Этап 15.3).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';

import 'package:shopguard_mobile/core/error/error_mapper.dart';
import 'package:shopguard_mobile/core/theme/app_theme.dart';
import 'package:shopguard_mobile/features/analytics/ui/analytics_style.dart';

void main() {
  group('analytics_style', () {
    test('severityColor: реальные значения', () {
      expect(severityColor('LOW'), Colors.green);
      expect(severityColor('MEDIUM'), Colors.orange);
      expect(severityColor('HIGH'), AppColors.danger);
      expect(severityColor('critical'), const Color(0xFFB91C1C));
      expect(severityColor('WAT'), AppColors.textMuted); // неизвестное
    });

    test('purchaseStatus: цвет и подпись', () {
      expect(purchaseStatusColor('MATCHED'), Colors.green);
      expect(purchaseStatusColor('PARTIAL_MATCH'), Colors.orange);
      expect(purchaseStatusColor('NOT_MATCHED'), AppColors.danger);
      expect(purchaseStatusLabel('MATCHED'), 'Совпало');
      expect(purchaseStatusLabel('NOT_MATCHED'), 'Не совпало');
    });

    test('riskColor: пороги 40/70', () {
      expect(riskColor(10), Colors.green);
      expect(riskColor(50), Colors.orange);
      expect(riskColor(85), AppColors.danger);
    });

    test('formatDuration', () {
      expect(formatDuration(null), '—');
      expect(formatDuration(45), '45с');
      expect(formatDuration(120), '2м');
      expect(formatDuration(150), '2м 30с');
    });
  });

  group('friendlyError', () {
    test('таймаут / нет сети', () {
      final t = DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: DioExceptionType.connectionTimeout);
      expect(friendlyError(t), contains('время'));
      final c = DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: DioExceptionType.connectionError);
      expect(friendlyError(c), contains('соединения'));
    });

    test('HTTP-коды', () {
      DioException resp(int code) => DioException(
            requestOptions: RequestOptions(path: '/x'),
            type: DioExceptionType.badResponse,
            response: Response(
                requestOptions: RequestOptions(path: '/x'), statusCode: code),
          );
      expect(friendlyError(resp(401)), contains('Сессия'));
      expect(friendlyError(resp(404)), contains('не найдены'));
      expect(friendlyError(resp(500)), contains('сервера'));
    });

    test('не-Dio ошибка', () {
      expect(friendlyError(Exception('x')), 'Не удалось загрузить данные.');
    });
  });
}
