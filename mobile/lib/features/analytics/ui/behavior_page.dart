import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/cubit/list_cubit.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/info_chip.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/analytics_models.dart';
import '../data/analytics_repositories.dart';
import 'analytics_style.dart';

class BehaviorPage extends StatelessWidget {
  const BehaviorPage({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<BehaviorRepository>();
    Future<List<BehaviorSession>> fetch() => repo.list(limit: 200);

    return BlocProvider(
      create: (_) => ListCubit<BehaviorSession>()..run(fetch),
      child: Scaffold(
        appBar: AppBar(title: const Text('Поведение')),
        body: BlocBuilder<ListCubit<BehaviorSession>,
            ListState<BehaviorSession>>(
          builder: (context, state) => AsyncListView<BehaviorSession>(
            state: state,
            onRefresh: () =>
                context.read<ListCubit<BehaviorSession>>().run(fetch),
            emptyText: 'Сессий поведения нет',
            emptyIcon: Icons.psychology_outlined,
            itemBuilder: (_, b) => _BehaviorCard(session: b),
          ),
        ),
      ),
    );
  }
}

class _BehaviorCard extends StatelessWidget {
  final BehaviorSession session;
  const _BehaviorCard({required this.session});

  @override
  Widget build(BuildContext context) {
    final high = session.riskScore >= 70;
    final rColor = riskColor(session.riskScore);
    return Card(
      // высокий риск выделяем цветной рамкой
      shape: high
          ? RoundedRectangleBorder(
              side: BorderSide(color: rColor, width: 1.5),
              borderRadius: BorderRadius.circular(12))
          : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('Track ${session.trackingId}',
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                StatusBadge(
                  label: session.behaviorType,
                  color: behaviorColor(session.behaviorType),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                StatusBadge(
                  label: 'Риск ${session.riskScore}',
                  color: rColor,
                  icon: high ? Icons.warning_amber : Icons.shield_outlined,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: session.riskScore / 100,
                      color: rColor,
                      backgroundColor: rColor.withValues(alpha: 0.15),
                      minHeight: 6,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                InfoChip(
                    icon: Icons.shopping_basket_outlined,
                    text: 'взял ${session.productsTaken}'),
                InfoChip(
                    icon: Icons.keyboard_return,
                    text: 'вернул ${session.productsReturned}'),
                InfoChip(
                    icon: Icons.schedule,
                    text: formatDuration(session.duration)),
                InfoChip(
                    icon: Icons.videocam_outlined,
                    text: '${session.visitedCameras.length} камер'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
