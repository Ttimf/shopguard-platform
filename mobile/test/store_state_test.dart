// Тест логики StoreState (Этап 15.5).
import 'package:flutter_test/flutter_test.dart';

import 'package:shopguard_mobile/features/cameras/data/camera_models.dart';
import 'package:shopguard_mobile/features/stores/cubit/store_cubit.dart';

void main() {
  StoreModel store(String? override) =>
      StoreModel(id: 's1', name: 'Shop', modelOverride: override);

  test('effectiveModel: override магазина имеет приоритет над default', () {
    const def = 'yolov8n';
    final withOverride = StoreState(
        status: StoreStatus.success, store: store('yolov8s'), aiDefault: def);
    expect(withOverride.effectiveModel, 'yolov8s');
    expect(withOverride.usesOverride, true);

    final noOverride = StoreState(
        status: StoreStatus.success, store: store(null), aiDefault: def);
    expect(noOverride.effectiveModel, 'yolov8n');
    expect(noOverride.usesOverride, false);
  });

  test('StoreState по умолчанию — loading, без магазина', () {
    const s = StoreState();
    expect(s.status, StoreStatus.loading);
    expect(s.store, isNull);
    expect(s.cameraCount, 0);
  });
}
