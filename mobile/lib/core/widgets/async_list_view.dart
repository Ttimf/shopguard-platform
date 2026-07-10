import 'package:flutter/material.dart';

import '../cubit/list_cubit.dart';
import '../theme/app_theme.dart';
import 'state_message.dart';

/// Универсальный список с состояниями Loading / Empty / Error+Retry / Success
/// и pull-to-refresh. Используется всеми аналитическими экранами.
class AsyncListView<T> extends StatelessWidget {
  final ListState<T> state;
  final Future<void> Function() onRefresh;
  final Widget Function(BuildContext, T) itemBuilder;
  final String emptyText;
  final IconData emptyIcon;
  final EdgeInsets padding;
  final Widget? separator;

  const AsyncListView({
    super.key,
    required this.state,
    required this.onRefresh,
    required this.itemBuilder,
    this.emptyText = 'Данных пока нет',
    this.emptyIcon = Icons.inbox_outlined,
    this.padding = const EdgeInsets.all(12),
    this.separator,
  });

  @override
  Widget build(BuildContext context) {
    switch (state.status) {
      case ListStatus.loading:
        return const Center(child: CircularProgressIndicator());
      case ListStatus.error:
        return StateMessage(
          icon: Icons.cloud_off_outlined,
          text: state.error ?? 'Ошибка загрузки',
          color: AppColors.danger,
          onRetry: onRefresh,
        );
      case ListStatus.success:
        if (state.items.isEmpty) {
          return RefreshIndicator(
            onRefresh: onRefresh,
            child: _Scrollable(
              child: StateMessage(icon: emptyIcon, text: emptyText),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: onRefresh,
          child: separator == null
              ? ListView.builder(
                  padding: padding,
                  itemCount: state.items.length,
                  itemBuilder: (c, i) => itemBuilder(c, state.items[i]),
                )
              : ListView.separated(
                  padding: padding,
                  itemCount: state.items.length,
                  separatorBuilder: (_, _) => separator!,
                  itemBuilder: (c, i) => itemBuilder(c, state.items[i]),
                ),
        );
    }
  }
}

/// Обёртка, делающая контент прокручиваемым (нужно для pull-to-refresh на Empty).
class _Scrollable extends StatelessWidget {
  final Widget child;
  const _Scrollable({required this.child});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (_, c) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: c.maxHeight),
          child: child,
        ),
      ),
    );
  }
}
