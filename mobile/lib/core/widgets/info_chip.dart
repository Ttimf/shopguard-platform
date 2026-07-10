import 'package:flutter/material.dart';

/// Универсальный компактный чип «иконка + текст» для метаданных
/// (камера, длительность, confidence…). Обобщает приватный `_chip` из camera_card.
class InfoChip extends StatelessWidget {
  final IconData icon;
  final String text;

  const InfoChip({super.key, required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Chip(
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      avatar: Icon(icon, size: 16),
      label: Text(text, style: const TextStyle(fontSize: 12)),
    );
  }
}
