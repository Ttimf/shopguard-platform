import 'package:flutter/material.dart';

/// Тема ShopGuard — тёмная «охранная».
class AppColors {
  static const primary = Color(0xFF2563EB); // синий
  static const danger = Color(0xFFEF4444); // тревога
  static const bg = Color(0xFF0F172A); // тёмный фон
  static const surface = Color(0xFF1E293B);
  static const textMuted = Color(0xFF94A3B8);
}

ThemeData buildTheme() {
  final base = ThemeData(brightness: Brightness.dark, useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: base.colorScheme.copyWith(
      primary: AppColors.primary,
      surface: AppColors.surface,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      elevation: 0,
      centerTitle: true,
    ),
    cardColor: AppColors.surface,
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );
}
