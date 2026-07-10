import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/info_chip.dart';
import '../../../core/widgets/labeled_row.dart';
import '../../../core/widgets/state_message.dart';
import '../../../core/widgets/status_badge.dart';
import '../../analytics/data/analytics_models.dart';
import '../../analytics/data/analytics_repositories.dart';
import '../../stores/data/store_repository.dart';
import '../cubit/camera_detail_cubit.dart';
import '../data/camera_models.dart';
import '../data/camera_repository.dart';
import 'camera_status.dart';

class CameraDetailPage extends StatelessWidget {
  final CameraModel camera;
  const CameraDetailPage({super.key, required this.camera});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) => CameraDetailCubit(
        ctx.read<CameraRepository>(),
        ctx.read<EventsEngineRepository>(),
        ctx.read<StoreRepository>(),
        ctx.read<AiModelsRepository>(),
        camera.id,
        initial: camera,
      )..load(),
      child: Scaffold(
        appBar: AppBar(title: Text(camera.name)),
        body: BlocBuilder<CameraDetailCubit, CameraDetailState>(
          builder: (context, state) {
            final cubit = context.read<CameraDetailCubit>();
            if (state.status == DetailStatus.loading && state.camera == null) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == DetailStatus.error && state.camera == null) {
              return StateMessage(
                icon: Icons.cloud_off_outlined,
                text: state.error ?? 'Ошибка загрузки',
                color: AppColors.danger,
                onRetry: cubit.load,
              );
            }
            final cam = state.camera!;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: [
                  _StatusCard(cam: cam, aiModel: state.aiModel),
                  const SizedBox(height: 12),
                  _TestCard(state: state, onTest: cubit.runTest),
                  const SizedBox(height: 12),
                  _InfoCard(cam: cam),
                  const SizedBox(height: 12),
                  _ActivityCard(last: state.lastActivity),
                  const SizedBox(height: 12),
                  _ErrorHistoryCard(events: state.errorEvents),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Заголовок: статус + AI + модель + последнее соединение.
class _StatusCard extends StatelessWidget {
  final CameraModel cam;
  final String? aiModel;
  const _StatusCard({required this.cam, required this.aiModel});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: cameraStatusColor(cam.status),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 10),
                Text(cameraStatusLabel(cam.status),
                    style: Theme.of(context).textTheme.titleLarge),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                StatusBadge(
                  label: cam.aiRunning ? 'AI работает' : 'AI стоп',
                  color: cam.aiRunning ? Colors.green : AppColors.textMuted,
                  icon: cam.aiRunning
                      ? Icons.play_circle_outline
                      : Icons.pause_circle_outline,
                ),
                InfoChip(icon: Icons.memory, text: aiModel ?? 'модель —'),
                InfoChip(
                    icon: Icons.link,
                    text: cam.lastOnline == null
                        ? 'связь: нет данных'
                        : 'связь: ${DateFormat('dd.MM HH:mm').format(cam.lastOnline!)}'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Проверка соединения: кнопка + Loading / Success / Error.
class _TestCard extends StatelessWidget {
  final CameraDetailState state;
  final Future<void> Function() onTest;
  const _TestCard({required this.state, required this.onTest});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Проверка соединения',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: state.testing ? null : onTest,
                icon: state.testing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.wifi_tethering),
                label: Text(state.testing ? 'Проверка…' : 'Проверить'),
              ),
            ),
            if (state.testError != null) ...[
              const SizedBox(height: 10),
              _line(Icons.error_outline, state.testError!, AppColors.danger),
            ] else if (state.testResult != null) ...[
              const SizedBox(height: 10),
              _result(state.testResult!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _result(CameraTestResult r) {
    if (!r.online) {
      return _line(Icons.cancel_outlined,
          r.error ?? 'Камера недоступна', AppColors.danger);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _line(Icons.check_circle_outline, 'Онлайн', Colors.green),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            if (r.resolution != null)
              InfoChip(icon: Icons.aspect_ratio, text: r.resolution!),
            if (r.fps != null) InfoChip(icon: Icons.speed, text: '${r.fps} FPS'),
            if (r.latency != null)
              InfoChip(icon: Icons.timer_outlined, text: '${r.latency} мс'),
          ],
        ),
      ],
    );
  }

  Widget _line(IconData icon, String text, Color color) => Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(color: color))),
        ],
      );
}

/// Полная информация о камере.
class _InfoCard extends StatelessWidget {
  final CameraModel cam;
  const _InfoCard({required this.cam});

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String)>[
      ('RTSP', cam.rtspUrl.isEmpty ? '—' : cam.rtspUrl),
      ('Логин', cam.username ?? '—'),
      ('Пароль', cam.hasPassword ? 'задан' : 'нет'),
      ('Производитель', cam.manufacturer ?? '—'),
      ('Модель камеры', cam.model ?? '—'),
      ('Расположение', cam.location ?? '—'),
      ('Лимит FPS', '${cam.fpsLimit}'),
      ('Текущий FPS', cam.fps?.toString() ?? '—'),
      ('Разрешение', cam.resolution ?? '—'),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Параметры',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final (k, v) in rows) LabeledRow(k, v),
          ],
        ),
      ),
    );
  }
}

/// Последняя активность (последнее событие Event Engine по камере).
class _ActivityCard extends StatelessWidget {
  final EngineEvent? last;
  const _ActivityCard({required this.last});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Последняя активность',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (last == null)
              const Text('Событий по камере нет',
                  style: TextStyle(color: AppColors.textMuted))
            else
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.sensors),
                title: Text(last!.eventType),
                subtitle: Text(
                    DateFormat('dd.MM.yy HH:mm').format(last!.timestamp)),
              ),
          ],
        ),
      ),
    );
  }
}

/// История последних ошибок (события CameraOffline).
class _ErrorHistoryCard extends StatelessWidget {
  final List<EngineEvent> events;
  const _ErrorHistoryCard({required this.events});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('История ошибок',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (events.isEmpty)
              const Text('Ошибок не зафиксировано',
                  style: TextStyle(color: AppColors.textMuted))
            else
              for (final e in events)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      const Icon(Icons.link_off,
                          size: 16, color: AppColors.danger),
                      const SizedBox(width: 8),
                      const Expanded(child: Text('Потеря соединения')),
                      Text(DateFormat('dd.MM HH:mm').format(e.timestamp),
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}
