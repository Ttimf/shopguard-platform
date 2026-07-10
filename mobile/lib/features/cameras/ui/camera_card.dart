import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/info_chip.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/camera_models.dart';
import 'camera_status.dart';

class CameraCard extends StatelessWidget {
  final CameraModel camera;
  final bool busy;
  final VoidCallback onOpen;
  final VoidCallback onTest;
  final VoidCallback onPreview;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final ValueChanged<bool> onToggle;

  const CameraCard({
    super.key,
    required this.camera,
    required this.busy,
    required this.onOpen,
    required this.onTest,
    required this.onPreview,
    required this.onEdit,
    required this.onDelete,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hint = cameraStatusHint(camera.status);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 6, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _StatusDot(status: camera.status),
                const SizedBox(width: 10),
                Expanded(
                  child: InkWell(
                    onTap: onOpen,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(camera.name,
                            style: Theme.of(context).textTheme.titleMedium,
                            overflow: TextOverflow.ellipsis),
                        if (camera.location != null &&
                            camera.location!.isNotEmpty)
                          Text(camera.location!,
                              style: TextStyle(
                                  color: scheme.outline, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
                if (busy)
                  const Padding(
                    padding: EdgeInsets.only(right: 8),
                    child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                else
                  Switch(value: camera.enabled, onChanged: onToggle),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StatusBadge(
                  label: cameraStatusLabel(camera.status),
                  color: cameraStatusColor(camera.status),
                ),
                StatusBadge(
                  label: camera.aiRunning ? 'AI работает' : 'AI стоп',
                  color: camera.aiRunning ? Colors.green : AppColors.textMuted,
                  icon: camera.aiRunning
                      ? Icons.play_circle_outline
                      : Icons.pause_circle_outline,
                ),
                if (camera.resolution != null)
                  InfoChip(icon: Icons.aspect_ratio, text: camera.resolution!),
                if (camera.fps != null)
                  InfoChip(icon: Icons.speed, text: '${camera.fps} FPS'),
                InfoChip(icon: Icons.schedule, text: _lastOnline),
              ],
            ),
            if (hint != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  children: [
                    Icon(Icons.error_outline,
                        size: 15, color: cameraStatusColor(camera.status)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(hint,
                          style: TextStyle(
                              color: cameraStatusColor(camera.status),
                              fontSize: 12)),
                    ),
                  ],
                ),
              ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: busy ? null : onTest,
                  icon: const Icon(Icons.wifi_tethering, size: 18),
                  label: const Text('Проверить'),
                ),
                IconButton(
                  tooltip: 'Превью',
                  onPressed: onPreview,
                  icon: const Icon(Icons.photo_camera_outlined),
                ),
                PopupMenuButton<String>(
                  onSelected: (v) => switch (v) {
                    'open' => onOpen(),
                    'edit' => onEdit(),
                    _ => onDelete(),
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'open', child: Text('Подробнее')),
                    PopupMenuItem(value: 'edit', child: Text('Изменить')),
                    PopupMenuItem(value: 'delete', child: Text('Удалить')),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String get _lastOnline => camera.lastOnline == null
      ? 'нет данных'
      : DateFormat('dd.MM HH:mm').format(camera.lastOnline!);
}

class _StatusDot extends StatelessWidget {
  final String status;
  const _StatusDot({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = cameraStatusColor(status);
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 6),
        ],
      ),
    );
  }
}
