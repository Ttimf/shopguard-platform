import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../core/theme/app_theme.dart';
import '../cubit/cameras_cubit.dart';
import '../data/camera_models.dart';
import '../data/camera_repository.dart';
import 'camera_card.dart';
import 'camera_detail_page.dart';
import 'camera_form_sheet.dart';
import 'create_store_sheet.dart';
import 'snapshot_dialog.dart';

class CamerasPage extends StatelessWidget {
  const CamerasPage({super.key});

  @override
  Widget build(BuildContext context) {
    final repo = context.read<CameraRepository>();
    return BlocProvider(
      create: (_) => CamerasCubit(repo)..load(),
      child: _CamerasView(repo: repo),
    );
  }
}

class _CamerasView extends StatelessWidget {
  final CameraRepository repo;
  const _CamerasView({required this.repo});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CamerasCubit, CamerasState>(
      listenWhen: (p, c) => c.error != null && p.error != c.error,
      listener: (context, state) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(state.error!)),
        );
      },
      builder: (context, state) {
        final cubit = context.read<CamerasCubit>();

        if (state.loading && state.cameras.isEmpty && state.stores.isEmpty) {
          return const _Skeleton();
        }
        if (state.firstStore == null) {
          return _EmptyStore(onCreate: () => _createStore(context, cubit));
        }

        return Scaffold(
          body: Column(
            children: [
              _SearchBar(
                onChanged: cubit.setSearch,
              ),
              _FilterBar(
                value: state.filter,
                onChanged: cubit.setFilter,
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: cubit.load,
                  child: state.visible.isEmpty
                      ? _EmptyCameras(hasAny: state.cameras.isNotEmpty)
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(8, 4, 8, 88),
                          itemCount: state.visible.length,
                          itemBuilder: (_, i) {
                            final cam = state.visible[i];
                            return CameraCard(
                              camera: cam,
                              busy: state.busyId == cam.id,
                              onOpen: () => _open(context, cam),
                              onToggle: (_) => cubit.toggleEnabled(cam),
                              onTest: () => _test(context, cubit, cam),
                              onPreview: () => _preview(context, cam),
                              onEdit: () => _addOrEdit(context, cubit, cam),
                              onDelete: () => _confirmDelete(context, cubit, cam),
                            );
                          },
                        ),
                ),
              ),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _addOrEdit(context, cubit, null),
            icon: const Icon(Icons.add),
            label: const Text('Камера'),
          ),
        );
      },
    );
  }

  Future<void> _createStore(BuildContext context, CamerasCubit cubit) async {
    final data = await showModalBottomSheet<(String, String?)>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const CreateStoreSheet(),
    );
    if (data != null) await cubit.createStore(data.$1, data.$2);
  }

  Future<void> _addOrEdit(
      BuildContext context, CamerasCubit cubit, CameraModel? camera) async {
    final payload = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => CameraFormSheet(camera: camera),
    );
    if (payload == null) return;
    if (camera == null) {
      await cubit.addCamera(payload);
    } else {
      await cubit.updateCamera(camera.id, payload);
    }
  }

  Future<void> _test(
      BuildContext context, CamerasCubit cubit, CameraModel cam) async {
    final result = await cubit.testCamera(cam.id);
    if (result == null || !context.mounted) return;
    final msg = result.online
        ? '🟢 Онлайн · ${result.resolution ?? '—'} · ${result.fps ?? '—'} FPS · ${result.latency ?? '—'} мс'
        : '🔴 ${result.error ?? 'Недоступна'}';
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

  void _preview(BuildContext context, CameraModel cam) {
    showDialog(
      context: context,
      builder: (_) => SnapshotDialog(repo: repo, camera: cam),
    );
  }

  void _open(BuildContext context, CameraModel cam) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => CameraDetailPage(camera: cam)),
    );
  }

  Future<void> _confirmDelete(
      BuildContext context, CamerasCubit cubit, CameraModel cam) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Удалить камеру?'),
        content: Text(cam.name),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Отмена'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Удалить'),
          ),
        ],
      ),
    );
    if (ok == true) await cubit.deleteCamera(cam.id);
  }
}

class _SearchBar extends StatelessWidget {
  final ValueChanged<String> onChanged;
  const _SearchBar({required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: TextField(
        onChanged: onChanged,
        decoration: InputDecoration(
          hintText: 'Поиск по названию или месту',
          prefixIcon: const Icon(Icons.search),
          filled: true,
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(28),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  final CameraFilter value;
  final ValueChanged<CameraFilter> onChanged;
  const _FilterBar({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: SegmentedButton<CameraFilter>(
        showSelectedIcon: false,
        segments: const [
          ButtonSegment(value: CameraFilter.all, label: Text('Все')),
          ButtonSegment(value: CameraFilter.online, label: Text('Онлайн')),
          ButtonSegment(value: CameraFilter.offline, label: Text('Оффлайн')),
        ],
        selected: {value},
        onSelectionChanged: (s) => onChanged(s.first),
      ),
    );
  }
}

class _EmptyStore extends StatelessWidget {
  final VoidCallback onCreate;
  const _EmptyStore({required this.onCreate});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.store_mall_directory_outlined,
              size: 64, color: AppColors.textMuted),
          const SizedBox(height: 12),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 32),
            child: Text('Создайте магазин, чтобы добавить камеры',
                textAlign: TextAlign.center),
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: onCreate, child: const Text('Создать магазин')),
        ],
      ),
    );
  }
}

class _EmptyCameras extends StatelessWidget {
  final bool hasAny;
  const _EmptyCameras({required this.hasAny});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 140),
        const Icon(Icons.videocam_off_outlined,
            size: 64, color: AppColors.textMuted),
        const SizedBox(height: 12),
        Center(
          child: Text(
            hasAny ? 'Ничего не найдено' : 'Камер пока нет',
            style: const TextStyle(color: AppColors.textMuted),
          ),
        ),
      ],
    );
  }
}

/// Скелет загрузки — пульсирующие карточки-заглушки.
class _Skeleton extends StatefulWidget {
  const _Skeleton();

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: 5,
      itemBuilder: (_, _) => FadeTransition(
        opacity: Tween(begin: 0.35, end: 0.75).animate(_ctl),
        child: Container(
          height: 120,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: base,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}
