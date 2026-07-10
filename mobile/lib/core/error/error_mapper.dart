import 'package:dio/dio.dart';

/// Единый маппинг ошибок сети в понятное пользователю сообщение.
/// Универсально: используется всеми Cubit'ами (устраняет дублирование try/catch).
String friendlyError(Object e) {
  if (e is DioException) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Превышено время ожидания. Проверьте соединение.';
      case DioExceptionType.connectionError:
        return 'Нет соединения с сервером.';
      case DioExceptionType.badResponse:
        final code = e.response?.statusCode;
        switch (code) {
          case 401:
            return 'Сессия истекла. Войдите заново.';
          case 403:
            return 'Нет доступа.';
          case 404:
            return 'Данные не найдены.';
          case 409:
            return 'Конфликт данных.';
          case 422:
            return 'Некорректный запрос.';
          case 500:
          case 502:
          case 503:
            return 'Ошибка сервера. Повторите позже.';
          default:
            return 'Ошибка запроса${code != null ? ' ($code)' : ''}.';
        }
      default:
        return 'Не удалось загрузить данные.';
    }
  }
  return 'Не удалось загрузить данные.';
}
