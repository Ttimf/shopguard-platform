import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../data/camera_models.dart';
import '../data/camera_repository.dart';

/// Диалог превью — текущий кадр камеры.
class SnapshotDialog extends StatelessWidget {
  final CameraRepository repo;
  final CameraModel camera;
  const SnapshotDialog({super.key, required this.repo, required this.camera});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.photo_camera_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(camera.name,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          AspectRatio(
            aspectRatio: 16 / 9,
            child: FutureBuilder<Uint8List>(
              future: repo.snapshot(camera.id),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snap.hasError || snap.data == null) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('Кадр недоступен — камера офлайн',
                          textAlign: TextAlign.center),
                    ),
                  );
                }
                return Image.memory(snap.data!, fit: BoxFit.contain);
              },
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
