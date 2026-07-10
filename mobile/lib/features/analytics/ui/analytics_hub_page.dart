import 'package:flutter/material.dart';

import 'ai_models_page.dart';
import 'alert_decisions_page.dart';
import 'behavior_page.dart';
import 'events_page.dart';
import 'purchases_page.dart';
import 'tracking_page.dart';

/// Хаб аналитики: список движков, каждый открывает свой экран.
/// Встроен как вкладка home_shell — своего AppBar не имеет.
class AnalyticsHubPage extends StatelessWidget {
  const AnalyticsHubPage({super.key});

  @override
  Widget build(BuildContext context) {
    final items = <_HubItem>[
      _HubItem(Icons.event_note_outlined, 'События',
          'Лог событий движка', const EventsPage()),
      _HubItem(Icons.route_outlined, 'Маршруты',
          'Перемещения между камерами', const TrackingPage()),
      _HubItem(Icons.psychology_outlined, 'Поведение',
          'Риск-скоринг покупателей', const BehaviorPage()),
      _HubItem(Icons.receipt_long_outlined, 'Покупки',
          'Сверка AI ↔ чек', const PurchasesPage()),
      _HubItem(Icons.notifications_active_outlined, 'Решения по тревогам',
          'Итоговые алерты', const AlertDecisionsPage()),
      _HubItem(Icons.memory_outlined, 'AI-модели',
          'Доступные модели', const AiModelsPage()),
    ];
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final it = items[i];
        return Card(
          child: ListTile(
            leading: Icon(it.icon),
            title: Text(it.title),
            subtitle: Text(it.subtitle),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => it.page),
            ),
          ),
        );
      },
    );
  }
}

class _HubItem {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget page;
  _HubItem(this.icon, this.title, this.subtitle, this.page);
}
