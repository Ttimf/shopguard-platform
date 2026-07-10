import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Центрированное сообщение состояния (Empty / Error) с опциональной кнопкой
/// повтора. Универсально — используется списками и одиночными экранами.
class StateMessage extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color? color;
  final Future<void> Function()? onRetry;

  const StateMessage({
    super.key,
    required this.icon,
    required this.text,
    this.color,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 64, color: color ?? AppColors.textMuted),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(text,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textMuted)),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            FilledButton.tonalIcon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Повторить'),
            ),
          ],
        ],
      ),
    );
  }
}
