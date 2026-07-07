import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/storage/token_storage.dart';
import '../../../core/theme/app_theme.dart';
import '../cubit/alerts_cubit.dart';
import '../data/alerts_socket.dart';
import '../data/event_model.dart';
import '../data/events_repository.dart';

class AlertsPage extends StatelessWidget {
  const AlertsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) => AlertsCubit(
        ctx.read<EventsRepository>(),
        AlertsSocket(ctx.read<TokenStorage>()),
      )..load(),
      child: const _AlertsView(),
    );
  }
}

class _AlertsView extends StatelessWidget {
  const _AlertsView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AlertsCubit, AlertsState>(
      builder: (context, state) {
        final cubit = context.read<AlertsCubit>();
        if (state.loading && state.events.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state.storeId == null) {
          return const Center(
            child: Text('Сначала создайте магазин и камеры'),
          );
        }
        if (state.events.isEmpty) {
          return RefreshIndicator(
            onRefresh: cubit.load,
            child: ListView(children: const [
              SizedBox(height: 160),
              Icon(Icons.shield_outlined,
                  size: 64, color: AppColors.textMuted),
              SizedBox(height: 12),
              Center(child: Text('Новых тревог нет')),
            ]),
          );
        }
        return RefreshIndicator(
          onRefresh: cubit.load,
          child: ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: state.events.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) => _AlertCard(event: state.events[i]),
          ),
        );
      },
    );
  }
}

class _AlertCard extends StatelessWidget {
  final AlertEvent event;
  const _AlertCard({required this.event});

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<AlertsCubit>();
    final color = event.isTheft ? AppColors.danger : Colors.orange;
    final title = event.isTheft
        ? 'Подозрение на кражу'
        : 'Чёрный список${event.personName != null ? ': ${event.personName}' : ''}';
    return Card(
      child: Column(
        children: [
          if (event.snapshotUrl != null)
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(12)),
              child: Image.network(
                event.snapshotUrl!,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
          ListTile(
            leading: Icon(
              event.isTheft ? Icons.warning_amber : Icons.face_retouching_off,
              color: color,
            ),
            title: Text(title,
                style: TextStyle(color: color, fontWeight: FontWeight.w700)),
            subtitle: Text(
              '${event.cameraName} · ${DateFormat('dd.MM HH:mm').format(event.createdAt)}',
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: () => cubit.setStatus(event.id, 'FALSE_ALARM'),
                child: const Text('Ложная'),
              ),
              TextButton(
                onPressed: () => cubit.setStatus(event.id, 'REVIEWED'),
                child: const Text('Просмотрено'),
              ),
              const SizedBox(width: 8),
            ],
          ),
        ],
      ),
    );
  }
}
