import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../core/cubit/list_cubit.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/info_chip.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/analytics_models.dart';
import '../data/analytics_repositories.dart';
import 'analytics_style.dart';

class AlertDecisionsPage extends StatelessWidget {
  const AlertDecisionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AlertDecisionsRepository>();
    Future<List<AlertDecision>> fetch() => repo.list(limit: 200);

    return BlocProvider(
      create: (_) => ListCubit<AlertDecision>()..run(fetch),
      child: Scaffold(
        appBar: AppBar(title: const Text('Решения по тревогам')),
        body: BlocBuilder<ListCubit<AlertDecision>, ListState<AlertDecision>>(
          builder: (context, state) => AsyncListView<AlertDecision>(
            state: state,
            onRefresh: () =>
                context.read<ListCubit<AlertDecision>>().run(fetch),
            emptyText: 'Тревог нет',
            emptyIcon: Icons.notifications_off_outlined,
            itemBuilder: (_, a) => _AlertCard(decision: a),
          ),
        ),
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final AlertDecision decision;
  const _AlertCard({required this.decision});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(decision.alertType,
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                StatusBadge(
                    label: decision.severity,
                    color: severityColor(decision.severity)),
              ],
            ),
            const SizedBox(height: 4),
            Text('Причина: ${decision.decision}',
                style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (decision.riskScore != null)
                  InfoChip(
                      icon: Icons.warning_amber,
                      text: 'риск ${decision.riskScore}'),
                if (decision.confidence != null)
                  InfoChip(
                      icon: Icons.percent, text: '${decision.confidence}%'),
                InfoChip(
                    icon: Icons.schedule,
                    text: DateFormat('dd.MM HH:mm').format(decision.createdAt)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
