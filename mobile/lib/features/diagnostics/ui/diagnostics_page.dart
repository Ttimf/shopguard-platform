import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/storage/token_storage.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/labeled_row.dart';
import '../../../core/widgets/status_badge.dart';
import '../../analytics/data/analytics_repositories.dart';
import '../../auth/data/auth_repository.dart';
import '../../cameras/data/camera_repository.dart';
import '../cubit/diagnostics_cubit.dart';

class DiagnosticsPage extends StatelessWidget {
  const DiagnosticsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) => DiagnosticsCubit(
        ctx.read<DioClient>(),
        ctx.read<AuthRepository>(),
        ctx.read<CameraRepository>(),
        ctx.read<AiModelsRepository>(),
        ctx.read<TokenStorage>(),
      )..run(),
      child: Scaffold(
        appBar: AppBar(title: const Text('Диагностика')),
        body: BlocBuilder<DiagnosticsCubit, DiagnosticsState>(
          builder: (context, state) {
            final cubit = context.read<DiagnosticsCubit>();
            if (state.running && state.ranAt == null) {
              return const Center(child: CircularProgressIndicator());
            }
            return RefreshIndicator(
              onRefresh: cubit.run,
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Проверки',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          _Check('Backend доступен', state.backendReachable),
                          _Check('API отвечает', state.apiResponds),
                          _Check('Авторизация активна', state.authActive),
                          _Check('Токен действителен', state.tokenValid),
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
                          Text('Данные',
                              style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 8),
                          LabeledRow('Камер',
                              state.cameraCount?.toString() ?? 'н/д'),
                          LabeledRow('Моделей',
                              state.modelCount?.toString() ?? 'н/д'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: state.running ? null : cubit.run,
                    icon: state.running
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.refresh),
                    label: Text(state.running ? 'Проверка…' : 'Проверить снова'),
                  ),
                  if (state.ranAt != null) ...[
                    const SizedBox(height: 10),
                    Center(
                      child: Text(
                        'Проверено: ${DateFormat('dd.MM HH:mm:ss').format(state.ranAt!)}',
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 12),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Check extends StatelessWidget {
  final String label;
  final bool ok;
  const _Check(this.label, this.ok);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Icon(ok ? Icons.check_circle : Icons.cancel,
              size: 20, color: ok ? Colors.green : AppColors.danger),
          const SizedBox(width: 10),
          Expanded(child: Text(label)),
          StatusBadge(
            label: ok ? 'OK' : 'СБОЙ',
            color: ok ? Colors.green : AppColors.danger,
          ),
        ],
      ),
    );
  }
}
