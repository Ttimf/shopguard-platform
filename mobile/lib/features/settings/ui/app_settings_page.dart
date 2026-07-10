import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/app_info.dart';
import '../../../core/widgets/labeled_row.dart';
import '../../../core/widgets/status_badge.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../diagnostics/ui/diagnostics_page.dart';

/// О приложении: версия, сервер, подключение, пользователь.
/// Данные локальные (без сети) — живые сетевые проверки на экране «Диагностика».
class AppSettingsPage extends StatelessWidget {
  const AppSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('О приложении')),
      body: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, auth) {
          final connected = auth.status == AuthStatus.authenticated;
          final user = auth.user;
          return ListView(
            padding: const EdgeInsets.all(12),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text('Приложение',
                              style: Theme.of(context).textTheme.titleMedium),
                          const Spacer(),
                          StatusBadge(
                            label: connected ? 'Подключено' : 'Не подключено',
                            color: connected
                                ? Colors.green
                                : AppColors.textMuted,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      LabeledRow('Версия приложения', appVersion),
                      // Версия backend в API отсутствует (см. отчёт).
                      const LabeledRow('Версия backend', 'недоступно (нет в API)'),
                      LabeledRow('Сервер', apiBaseUrl),
                      LabeledRow('Подключение',
                          connected ? 'активно' : 'нет сессии'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Пользователь',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      LabeledRow('Имя', user?.name ?? '—'),
                      LabeledRow('Email', user?.email ?? '—'),
                      LabeledRow(
                          'Роль', _roleLabel(user?.role)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.health_and_safety_outlined),
                  title: const Text('Диагностика системы'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const DiagnosticsPage()),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _roleLabel(String? role) => switch (role) {
        'OWNER' => 'Владелец',
        'GUARD' => 'Охрана',
        _ => '—',
      };
}
