import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/api/dio_client.dart';
import 'core/storage/token_storage.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/cubit/auth_cubit.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/ui/login_page.dart';
import 'features/alerts/data/events_repository.dart';
import 'features/analytics/data/analytics_repositories.dart';
import 'features/cameras/data/camera_repository.dart';
import 'features/home/ui/home_shell.dart';
import 'features/settings/data/settings_repository.dart';
import 'features/stores/data/store_repository.dart';

void main() {
  final storage = TokenStorage();
  final client = DioClient(storage);
  runApp(ShopGuardApp(storage: storage, client: client));
}

class ShopGuardApp extends StatelessWidget {
  final TokenStorage storage;
  final DioClient client;
  const ShopGuardApp({super.key, required this.storage, required this.client});

  @override
  Widget build(BuildContext context) {
    // Единые зависимости: один DioClient/TokenStorage на всё приложение.
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider.value(value: storage),
        RepositoryProvider.value(value: client),
        RepositoryProvider(create: (_) => AuthRepository(client, storage)),
        RepositoryProvider(create: (_) => CameraRepository(client)),
        RepositoryProvider(create: (_) => EventsRepository(client)),
        RepositoryProvider(create: (_) => SettingsRepository(client)),
        RepositoryProvider(create: (_) => StoreRepository(client)),
        // Аналитические движки (Этап 15.2) — только чтение.
        RepositoryProvider(create: (_) => EventsEngineRepository(client)),
        RepositoryProvider(create: (_) => TrackingRepository(client)),
        RepositoryProvider(create: (_) => BehaviorRepository(client)),
        RepositoryProvider(create: (_) => PurchaseRepository(client)),
        RepositoryProvider(create: (_) => AlertDecisionsRepository(client)),
        RepositoryProvider(create: (_) => AiModelsRepository(client)),
      ],
      child: BlocProvider(
        create: (ctx) => AuthCubit(ctx.read<AuthRepository>())..appStarted(),
        child: MaterialApp(
          title: 'ShopGuard',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(),
          home: const _Root(),
        ),
      ),
    );
  }
}

/// Переключает экран по состоянию авторизации.
class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      buildWhen: (a, b) => a.status != b.status,
      builder: (context, state) {
        switch (state.status) {
          case AuthStatus.authenticated:
            return const HomeShell();
          case AuthStatus.unauthenticated:
            return const LoginPage();
          case AuthStatus.unknown:
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
        }
      },
    );
  }
}
