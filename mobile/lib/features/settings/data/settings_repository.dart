import '../../../core/api/dio_client.dart';

/// Настройки магазина: чтение и установка Telegram chat_id.
class SettingsRepository {
  final DioClient _client;
  SettingsRepository(this._client);

  /// Первый магазин владельца: (id, telegramChatId) либо null.
  Future<({String id, String? telegramChatId})?> firstStore() async {
    final res = await _client.dio.get('/stores');
    final list = res.data as List;
    if (list.isEmpty) return null;
    final s = list.first as Map<String, dynamic>;
    return (id: s['id'] as String, telegramChatId: s['telegramChatId'] as String?);
  }

  Future<void> setTelegram(String storeId, String? chatId) async {
    await _client.dio.patch('/stores/$storeId/telegram',
        data: {'chatId': (chatId != null && chatId.isEmpty) ? null : chatId});
  }
}
