import 'package:flutter/material.dart';

import '../../cameras/ui/cameras_page.dart';
import '../../alerts/ui/alerts_page.dart';
import '../../history/ui/history_page.dart';
import '../../profile/ui/profile_page.dart';

/// Каркас после входа: нижняя навигация.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _pages = [
    CamerasPage(),
    AlertsPage(),
    HistoryPage(),
    ProfilePage(),
  ];
  static const _titles = ['Камеры', 'Алерты', 'История', 'Профиль'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_titles[_index])),
      body: _pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.videocam_outlined), label: 'Камеры'),
          NavigationDestination(
              icon: Icon(Icons.notifications_active_outlined),
              label: 'Алерты'),
          NavigationDestination(icon: Icon(Icons.history), label: 'История'),
          NavigationDestination(
              icon: Icon(Icons.person_outline), label: 'Профиль'),
        ],
      ),
    );
  }
}
