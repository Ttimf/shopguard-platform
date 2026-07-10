import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/labeled_row.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../settings/ui/app_settings_page.dart';
import '../../settings/ui/settings_page.dart';
import '../../stores/data/store_repository.dart';
import '../../stores/ui/store_page.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthCubit>().state.user;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SizedBox(height: 12),
        const CircleAvatar(
          radius: 36,
          backgroundColor: AppColors.primary,
          child: Icon(Icons.person, size: 40, color: Colors.white),
        ),
        const SizedBox(height: 12),
        Text(user?.name ?? user?.email ?? 'Пользователь',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LabeledRow('Имя', user?.name ?? '—'),
                LabeledRow('Email', user?.email ?? '—'),
                LabeledRow('Роль', _roleLabel(user?.role)),
                _StoreRow(),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        _navCard(context, Icons.store_mall_directory_outlined, 'Магазин',
            const StorePage()),
        _navCard(context, Icons.send_outlined, 'Telegram-алерты',
            const SettingsPage()),
        _navCard(context, Icons.info_outline, 'О приложении',
            const AppSettingsPage()),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => context.read<AuthCubit>().logout(),
          icon: const Icon(Icons.logout, color: AppColors.danger),
          label: const Text('Выйти',
              style: TextStyle(color: AppColors.danger)),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(50),
            side: const BorderSide(color: AppColors.danger),
          ),
        ),
      ],
    );
  }

  Widget _navCard(
          BuildContext context, IconData icon, String title, Widget page) =>
      Card(
        child: ListTile(
          leading: Icon(icon),
          title: Text(title),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => page)),
        ),
      );

  String _roleLabel(String? role) => switch (role) {
        'OWNER' => 'Владелец',
        'GUARD' => 'Охрана',
        _ => '—',
      };
}

/// Название магазина владельца (реюз StoreRepository).
class _StoreRow extends StatefulWidget {
  @override
  State<_StoreRow> createState() => _StoreRowState();
}

class _StoreRowState extends State<_StoreRow> {
  late final Future<List<dynamic>> _future =
      context.read<StoreRepository>().list();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _future,
      builder: (context, snap) {
        final name = snap.hasData && snap.data!.isNotEmpty
            ? snap.data!.first.name as String
            : (snap.connectionState == ConnectionState.waiting ? '…' : '—');
        return LabeledRow('Магазин', name);
      },
    );
  }
}
