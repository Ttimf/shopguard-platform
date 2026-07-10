import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/cubit/list_cubit.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/info_chip.dart';
import '../data/analytics_models.dart';
import '../data/analytics_repositories.dart';

/// Реальные типы событий backend (EngineEventType). Не выдуманы.
const _eventTypes = [
  'PersonDetected',
  'PersonEntered',
  'PersonExited',
  'ProductTaken',
  'ProductReturned',
  'SuspiciousActivity',
  'CameraOffline',
  'CameraOnline',
  'ModelSwitched',
  'PurchaseMismatch',
  'AlertCreated',
];

const _periods = {
  'Всё время': null,
  '24 часа': Duration(hours: 24),
  '7 дней': Duration(days: 7),
  '30 дней': Duration(days: 30),
};

class EventsPage extends StatefulWidget {
  const EventsPage({super.key});

  @override
  State<EventsPage> createState() => _EventsPageState();
}

class _EventsPageState extends State<EventsPage> {
  String _period = 'Всё время';
  String? _eventType; // null — все

  late final EventsEngineRepository _repo = context.read<EventsEngineRepository>();
  final _cubit = ListCubit<EngineEvent>();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  Future<void> _load() {
    final dur = _periods[_period];
    final from =
        dur == null ? null : DateTime.now().toUtc().subtract(dur).toIso8601String();
    return _cubit.run(() => _repo.list(
          eventType: _eventType,
          from: from,
          limit: 200,
        ));
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: Scaffold(
        appBar: AppBar(title: const Text('События')),
        body: Column(
          children: [
            _filters(),
            Expanded(
              child: BlocBuilder<ListCubit<EngineEvent>, ListState<EngineEvent>>(
                bloc: _cubit,
                builder: (context, state) => AsyncListView<EngineEvent>(
                  state: state,
                  onRefresh: _load,
                  emptyText: 'Событий нет',
                  emptyIcon: Icons.event_note_outlined,
                  itemBuilder: (_, e) => _EventCard(event: e),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filters() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: _period,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Период', isDense: true, border: OutlineInputBorder()),
              items: _periods.keys
                  .map((k) => DropdownMenuItem(value: k, child: Text(k)))
                  .toList(),
              onChanged: (v) {
                if (v == null) return;
                setState(() => _period = v);
                _load();
              },
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: DropdownButtonFormField<String?>(
              initialValue: _eventType,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Тип', isDense: true, border: OutlineInputBorder()),
              items: [
                const DropdownMenuItem(value: null, child: Text('Все')),
                ..._eventTypes.map(
                    (t) => DropdownMenuItem(value: t, child: Text(t))),
              ],
              onChanged: (v) {
                setState(() => _eventType = v);
                _load();
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  final EngineEvent event;
  const _EventCard({required this.event});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(event.eventType,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                Text(DateFormat('dd.MM HH:mm').format(event.timestamp),
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                InfoChip(
                    icon: Icons.videocam_outlined,
                    text: event.cameraId ?? 'камера —'),
                if (event.confidence != null)
                  InfoChip(
                      icon: Icons.percent,
                      text: '${(event.confidence! * 100).round()}%'),
                if (event.trackingId != null)
                  InfoChip(
                      icon: Icons.tag, text: 'track ${event.trackingId}'),
                if (event.modelVersion != null)
                  InfoChip(
                      icon: Icons.memory, text: event.modelVersion!),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
