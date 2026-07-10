import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/cubit/list_cubit.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/info_chip.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/analytics_models.dart';
import '../data/analytics_repositories.dart';
import 'analytics_style.dart';

class PurchasesPage extends StatelessWidget {
  const PurchasesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<PurchaseRepository>();
    Future<List<PurchaseSession>> fetch() => repo.list(limit: 200);

    return BlocProvider(
      create: (_) => ListCubit<PurchaseSession>()..run(fetch),
      child: Scaffold(
        appBar: AppBar(title: const Text('Покупки')),
        body: BlocBuilder<ListCubit<PurchaseSession>,
            ListState<PurchaseSession>>(
          builder: (context, state) => AsyncListView<PurchaseSession>(
            state: state,
            onRefresh: () =>
                context.read<ListCubit<PurchaseSession>>().run(fetch),
            emptyText: 'Покупок нет',
            emptyIcon: Icons.receipt_long_outlined,
            itemBuilder: (_, p) => _PurchaseCard(session: p),
          ),
        ),
      ),
    );
  }
}

class _PurchaseCard extends StatelessWidget {
  final PurchaseSession session;
  const _PurchaseCard({required this.session});

  @override
  Widget build(BuildContext context) {
    final color = purchaseStatusColor(session.status);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                StatusBadge(
                    label: purchaseStatusLabel(session.status), color: color),
                const Spacer(),
                InfoChip(
                    icon: Icons.percent, text: '${session.confidence}%'),
              ],
            ),
            if (session.missingProducts.isNotEmpty) ...[
              const SizedBox(height: 8),
              _Items(
                title: 'Не в чеке (возможная кража)',
                items: session.missingProducts,
                color: AppColors.danger,
                icon: Icons.remove_shopping_cart_outlined,
              ),
            ],
            if (session.extraProducts.isNotEmpty) ...[
              const SizedBox(height: 8),
              _Items(
                title: 'Лишнее в чеке',
                items: session.extraProducts,
                color: Colors.orange,
                icon: Icons.add_shopping_cart_outlined,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Items extends StatelessWidget {
  final String title;
  final List<String> items;
  final Color color;
  final IconData icon;
  const _Items(
      {required this.title,
      required this.items,
      required this.color,
      required this.icon});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(title,
                style: TextStyle(
                    color: color, fontSize: 12, fontWeight: FontWeight.w700)),
          ],
        ),
        const SizedBox(height: 4),
        Text(items.join(', '),
            style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
      ],
    );
  }
}
