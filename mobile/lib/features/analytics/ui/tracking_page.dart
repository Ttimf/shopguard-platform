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

/// Маршрут одного человека: сегменты (визиты камер), упорядоченные по времени.
class _Route {
  final String trackingId;
  final List<PersonTrack> segments; // отсортированы по enteredAt
  _Route(this.trackingId, this.segments);

  bool get active => segments.any((s) => s.active);
  int? get totalDuration {
    final withDur = segments.where((s) => s.duration != null);
    if (withDur.isEmpty) return null;
    return withDur.fold<int>(0, (a, s) => a + s.duration!);
  }

  List<String> get cameras =>
      segments.map((s) => s.cameraId).where((c) => c.isNotEmpty).toList();
}

List<_Route> _group(List<PersonTrack> tracks) {
  final byId = <String, List<PersonTrack>>{};
  for (final t in tracks) {
    byId.putIfAbsent(t.trackingId, () => []).add(t);
  }
  final routes = byId.entries.map((e) {
    final segs = [...e.value]..sort((a, b) => a.enteredAt.compareTo(b.enteredAt));
    return _Route(e.key, segs);
  }).toList();
  // активные сверху, затем по времени входа (свежие выше)
  routes.sort((a, b) {
    if (a.active != b.active) return a.active ? -1 : 1;
    return b.segments.first.enteredAt.compareTo(a.segments.first.enteredAt);
  });
  return routes;
}

class TrackingPage extends StatelessWidget {
  const TrackingPage({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<TrackingRepository>();
    Future<List<_Route>> fetch() async => _group(await repo.list(limit: 300));

    return BlocProvider(
      create: (_) => ListCubit<_Route>()..run(fetch),
      child: Scaffold(
        appBar: AppBar(title: const Text('Маршруты')),
        body: BlocBuilder<ListCubit<_Route>, ListState<_Route>>(
          builder: (context, state) => AsyncListView<_Route>(
            state: state,
            onRefresh: () => context.read<ListCubit<_Route>>().run(fetch),
            emptyText: 'Маршрутов нет',
            emptyIcon: Icons.route_outlined,
            itemBuilder: (_, r) => _RouteCard(route: r),
          ),
        ),
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final _Route route;
  const _RouteCard({required this.route});

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
                  child: Text('Track ${route.trackingId}',
                      style: Theme.of(context).textTheme.titleMedium),
                ),
                StatusBadge(
                  label: route.active ? 'Активен' : 'Завершён',
                  color: route.active ? Colors.green : AppColors.textMuted,
                  icon: route.active ? Icons.circle : Icons.check,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                InfoChip(
                    icon: Icons.videocam_outlined,
                    text: '${route.cameras.length} камер'),
                InfoChip(
                    icon: Icons.schedule,
                    text: formatDuration(route.totalDuration)),
              ],
            ),
            if (route.cameras.isNotEmpty) ...[
              const SizedBox(height: 8),
              _CameraPath(cameras: route.cameras),
            ],
          ],
        ),
      ),
    );
  }
}

/// История перемещения: cam1 → cam2 → cam3.
class _CameraPath extends StatelessWidget {
  final List<String> cameras;
  const _CameraPath({required this.cameras});

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    for (var i = 0; i < cameras.length; i++) {
      children.add(InfoChip(icon: Icons.place_outlined, text: cameras[i]));
      if (i < cameras.length - 1) {
        children.add(const Icon(Icons.arrow_right_alt, size: 18));
      }
    }
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: children,
    );
  }
}
