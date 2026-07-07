import 'package:flutter/material.dart';

/// Форма создания магазина. Возвращает (name, address?).
class CreateStoreSheet extends StatefulWidget {
  const CreateStoreSheet({super.key});

  @override
  State<CreateStoreSheet> createState() => _CreateStoreSheetState();
}

class _CreateStoreSheetState extends State<CreateStoreSheet> {
  final _name = TextEditingController();
  final _address = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Новый магазин',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 16),
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Название'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _address,
            decoration: const InputDecoration(labelText: 'Адрес (необязательно)'),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              final name = _name.text.trim();
              if (name.length < 2) return;
              final address = _address.text.trim();
              Navigator.of(context)
                  .pop((name, address.isEmpty ? null : address));
            },
            child: const Text('Создать'),
          ),
        ],
      ),
    );
  }
}
