import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/cubit/list_cubit.dart';
import '../../../core/widgets/async_list_view.dart';
import '../../../core/widgets/status_badge.dart';
import '../data/analytics_repositories.dart';

/// Строка списка моделей (name + признак активной по умолчанию).
class _ModelRow {
  final String name;
  final bool isDefault;
  _ModelRow(this.name, this.isDefault);
}

class AiModelsPage extends StatelessWidget {
  const AiModelsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<AiModelsRepository>();
    Future<List<_ModelRow>> fetch() async {
      final info = await repo.get();
      final names = {...info.available, if (info.defaultModel != null) info.defaultModel!};
      return names.map((n) => _ModelRow(n, n == info.defaultModel)).toList()
        ..sort((a, b) => a.isDefault == b.isDefault
            ? a.name.compareTo(b.name)
            : (a.isDefault ? -1 : 1));
    }

    return BlocProvider(
      create: (_) => ListCubit<_ModelRow>()..run(fetch),
      child: Scaffold(
        appBar: AppBar(title: const Text('AI-модели')),
        body: BlocBuilder<ListCubit<_ModelRow>, ListState<_ModelRow>>(
          builder: (context, state) => AsyncListView<_ModelRow>(
            state: state,
            onRefresh: () => context.read<ListCubit<_ModelRow>>().run(fetch),
            emptyText: 'Моделей нет',
            emptyIcon: Icons.memory_outlined,
            itemBuilder: (_, m) => _ModelCard(row: m),
          ),
        ),
      ),
    );
  }
}

class _ModelCard extends StatelessWidget {
  final _ModelRow row;
  const _ModelCard({required this.row});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(
          Icons.memory,
          color: row.isDefault ? Colors.green : null,
        ),
        title: Text(row.name),
        subtitle: const Text('версия модели'),
        trailing: row.isDefault
            ? const StatusBadge(label: 'Активная', color: Colors.green)
            : null,
      ),
    );
  }
}
