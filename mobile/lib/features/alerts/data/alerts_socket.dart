import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/storage/token_storage.dart';
import 'event_model.dart';

/// WebSocket-подписка на живые тревоги магазина (gateway /ws/alerts).
class AlertsSocket {
  final TokenStorage _storage;
  WebSocketChannel? _channel;
  final _controller = StreamController<AlertEvent>.broadcast();

  AlertsSocket(this._storage);

  Stream<AlertEvent> get alerts => _controller.stream;

  Future<void> connect(String storeId) async {
    if (_channel != null) return; // уже подключены — без дублирования соединений
    final token = await _storage.access;
    if (token == null) return;
    final url = _wsUrl(token);
    final channel = WebSocketChannel.connect(Uri.parse(url));
    _channel = channel;
    channel.stream.listen(
      (raw) => _onMessage(raw as String),
      onError: (_) => _channel = null, // разрыв → позволить переподключение
      onDone: () => _channel = null,
      cancelOnError: true,
    );
    channel.sink.add(jsonEncode({
      'event': 'subscribe',
      'data': {'storeId': storeId},
    }));
  }

  void _onMessage(String raw) {
    final msg = jsonDecode(raw) as Map<String, dynamic>;
    if (msg['event'] == 'alert') {
      _controller.add(AlertEvent.fromJson(msg['data'] as Map<String, dynamic>));
    }
  }

  String _wsUrl(String token) {
    // http://host:8080/api  ->  ws://host:8080/ws/alerts?token=...
    var base = apiBaseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    base = base.replaceFirst('https://', 'wss://').replaceFirst('http://', 'ws://');
    return '$base/ws/alerts?token=$token';
  }

  void dispose() {
    _channel?.sink.close();
    _controller.close();
  }
}
