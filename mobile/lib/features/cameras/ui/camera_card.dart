import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/camera_models.dart';

class CameraCard extends StatelessWidget {
  final CameraModel camera;
  final bool busy;
  final VoidCallback onTest;
  final VoidCallback onPreview;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final ValueChanged<bool> onToggle;

  const CameraCard({
    super.key,
    required this.camera,
    required this.busy,
    required this.onTest,
    required this.onPreview,
    required this.onEdit,
    required this.onDelete,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 6, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _StatusDot(camera: camera),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(camera.name,
                          style: Theme.of(context).textTheme.titleMedium,
                          overflow: TextOverflow.ellipsis),
                      if (camera.location != null &&
                          camera.location!.isNotEmpty)
                        Text(camera.location!,
                            style: TextStyle(color: scheme.outline, fontSize: 12)),
                    ],
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
              runSpacing: 4,
              children: [
                _chip(Icons.sensors, _statusLabel),
                if (camera.resolution != null)
                  _chip(Icons.aspect_ratio, camera.resolution!),
                if (camera.fps != null) _chip(Icons.speed, '${camera.fps} FPS'),
                _chip(Icons.schedule, _lastOnline),
              ],
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
                  onSelected: (v) => v == 'edit' ? onEdit() : onDelete(),
                  itemBuilder: (_) => const [
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

  String get _statusLabel => switch (camera.status) {
        'ONLINE' => 'Онлайн',
        'OFFLINE' => 'Оффлайн',
        _ => 'Неизвестно',
      };

  String get _lastOnline => camera.lastOnline == null
      ? 'нет данных'
      : DateFormat('dd.MM HH:mm').format(camera.lastOnline!);

  Widget _chip(IconData icon, String text) => Chip(
        visualDensity: VisualDensity.compact,
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        avatar: Icon(icon, size: 16),
        label: Text(text, style: const TextStyle(fontSize: 12)),
      );
}

class _StatusDot extends StatelessWidget {
  final CameraModel camera;
  const _StatusDot({required this.camera});

  @override
  Widget build(BuildContext context) {
    final color = camera.isOnline
        ? Colors.green
        : camera.isOffline
            ? Colors.red
            : Colors.grey;
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
