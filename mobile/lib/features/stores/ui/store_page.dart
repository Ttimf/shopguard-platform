import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/info_chip.dart';
import '../../../core/widgets/labeled_row.dart';
import '../../../core/widgets/state_message.dart';
import '../../../core/widgets/status_badge.dart';
import '../../analytics/data/analytics_repositories.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../cameras/data/camera_repository.dart';
import '../cubit/store_cubit.dart';
import '../data/store_repository.dart';

class StorePage extends StatelessWidget {
  const StorePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (ctx) => StoreCubit(
        ctx.read<StoreRepository>(),
        ctx.read<CameraRepository>(),
        ctx.read<AiModelsRepository>(),
      )..load(),
      child: Scaffold(
        appBar: AppBar(title: const Text('Магазин')),
        body: BlocBuilder<StoreCubit, StoreState>(
          builder: (context, state) {
            final cubit = context.read<StoreCubit>();
            if (state.status == StoreStatus.loading) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == StoreStatus.error) {
              return StateMessage(
                icon: Icons.cloud_off_outlined,
                text: state.error ?? 'Ошибка загрузки',
                color: AppColors.danger,
                onRetry: cubit.load,
              );
            }
            if (state.store == null) {
              return RefreshIndicator(
                onRefresh: cubit.load,
                child: ListView(children: const [
                  SizedBox(height: 160),
                  StateMessage(
                      icon: Icons.store_mall_directory_outlined,
                      text: 'Магазин ещё не создан'),
                ]),
              );
            }
            final user = context.read<AuthCubit>().state.user;
            return RefreshIndicator(
              onRefresh: cubit.load,
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: [
                  _InfoCard(state: state, ownerName: user?.name ?? user?.email),
                  const SizedBox(height: 12),
                  _AiCard(state: state),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final StoreState state;
  final String? ownerName;
  const _InfoCard({required this.state, required this.ownerName});

  @override
  Widget build(BuildContext context) {
    final store = state.store!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(store.name,
                      style: Theme.of(context).textTheme.titleLarge),
                ),
                StatusBadge(
                  label: state.cameraCount == 0
                      ? 'Нет камер'
                      : '${state.onlineCount}/${state.cameraCount} онлайн',
                  color: state.onlineCount > 0
                      ? Colors.green
                      : AppColors.textMuted,
                ),
              ],
            ),
            const SizedBox(height: 12),
            LabeledRow('Адрес', store.address ?? '—'),
            LabeledRow('Владелец', ownerName ?? '—'),
            LabeledRow('Камер', '${state.cameraCount}'),
            if (store.createdAt != null)
              LabeledRow('Создан',
                  DateFormat('dd.MM.yyyy').format(store.createdAt!)),
          ],
        ),
      ),
    );
  }
}

class _AiCard extends StatelessWidget {
  final StoreState state;
  const _AiCard({required this.state});

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
                Text('AI-модель',
                    style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                InfoChip(
                    icon: Icons.memory,
                    text: state.effectiveModel ?? '—'),
              ],
            ),
            const SizedBox(height: 8),
            LabeledRow('Текущая / версия', state.effectiveModel ?? '—'),
            LabeledRow('Модель магазина',
                state.usesOverride ? state.store!.modelOverride! : 'по умолчанию'),
            LabeledRow('По умолчанию', state.aiDefault ?? '—'),
          ],
        ),
      ),
    );
  }
}
