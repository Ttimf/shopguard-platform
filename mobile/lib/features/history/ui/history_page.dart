import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../alerts/data/event_model.dart';
import '../../alerts/data/events_repository.dart';

/// История событий магазина (все статусы, только чтение).
class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  late final EventsRepository _repo;
  late Future<List<AlertEvent>> _future;

  @override
  void initState() {
    super.initState();
    _repo = context.read<EventsRepository>();
    _future = _load();
  }

  Future<List<AlertEvent>> _load() async {
    final storeId = await _repo.firstStoreId();
    if (storeId == null) return [];
    return _repo.list(storeId);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AlertEvent>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final events = snap.data ?? [];
        if (events.isEmpty) {
          return const Center(child: Text('Событий пока нет'));
        }
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: events.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (_, i) => _tile(events[i]),
          ),
        );
      },
    );
  }

  Widget _tile(AlertEvent e) {
    final color = e.isTheft ? AppColors.danger : Colors.orange;
    return ListTile(
      leading: Icon(
        e.isTheft ? Icons.warning_amber : Icons.face_retouching_off,
        color: color,
      ),
      title: Text(e.isTheft
          ? 'Кража'
          : 'ЧС${e.personName != null ? ': ${e.personName}' : ''}'),
      subtitle: Text(
          '${e.cameraName} · ${DateFormat('dd.MM.yy HH:mm').format(e.createdAt)}'),
      trailing: _statusChip(e.status),
    );
  }

  Widget _statusChip(String status) {
    final map = {
      'NEW': ('Новое', AppColors.primary),
      'REVIEWED': ('Просмотрено', AppColors.textMuted),
      'FALSE_ALARM': ('Ложное', AppColors.textMuted),
    };
    final (label, color) = map[status] ?? ('—', AppColors.textMuted);
    return Text(label, style: TextStyle(color: color, fontSize: 12));
  }
}
