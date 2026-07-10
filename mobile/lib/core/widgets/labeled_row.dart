import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Универсальная строка «метка — значение». Используется на экранах
/// магазина, настроек приложения и деталей камеры.
class LabeledRow extends StatelessWidget {
  final String label;
  final String value;
  final double labelWidth;

  const LabeledRow(this.label, this.value, {super.key, this.labelWidth = 140});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: labelWidth,
            child: Text(label,
                style: const TextStyle(color: AppColors.textMuted)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
