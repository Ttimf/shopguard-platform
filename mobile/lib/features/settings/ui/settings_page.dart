import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/theme/app_theme.dart';
import '../data/settings_repository.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final SettingsRepository _repo;
  final _chatId = TextEditingController();
  String? _storeId;
  bool _loading = true;
  bool _saving = false;
  String? _msg;

  @override
  void initState() {
    super.initState();
    _repo = context.read<SettingsRepository>();
    _load();
  }

  Future<void> _load() async {
    final store = await _repo.firstStore();
    setState(() {
      _storeId = store?.id;
      _chatId.text = store?.telegramChatId ?? '';
      _loading = false;
    });
  }

  Future<void> _save() async {
    if (_storeId == null) return;
    setState(() {
      _saving = true;
      _msg = null;
    });
    try {
      await _repo.setTelegram(_storeId!, _chatId.text.trim());
      setState(() => _msg = 'Сохранено');
    } catch (_) {
      setState(() => _msg = 'Ошибка сохранения');
    } finally {
      setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _chatId.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Настройки')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _storeId == null
              ? const Center(child: Text('Сначала создайте магазин'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const Text('Telegram-алерты',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    const Text(
                      'Укажите chat_id, куда бот будет присылать тревоги. '
                      'Узнать его можно у @userinfobot. Пусто — Telegram выключен.',
                      style: TextStyle(color: AppColors.textMuted),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _chatId,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Telegram chat_id',
                        prefixIcon: Icon(Icons.send),
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Text('Сохранить'),
                    ),
                    if (_msg != null) ...[
                      const SizedBox(height: 12),
                      Text(_msg!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textMuted)),
                    ],
                  ],
                ),
    );
  }
}
