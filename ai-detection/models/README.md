# Модели YOLO — ShopGuard

Веса моделей (`*.pt`) сюда **не коммитятся** (бинарные, большие). В образе Docker
`official/shopguard_v1.pt` создаётся на этапе сборки (базовый YOLOv8n).

```
models/
  official/        # официальные модели ShopGuard
    shopguard_v1.pt
    shopguard_v2.pt
  custom/          # дообученные модели заказчика
    customer_model_001.pt
```

Текущая модель задаётся переменной окружения `YOLO_MODEL`
(напр. `YOLO_MODEL=models/official/shopguard_v1.pt`).

Подробнее об управлении моделями — см. [../MODEL_MANAGEMENT.md](../MODEL_MANAGEMENT.md).

## Локальный запуск
Положите файл модели в `official/` или `custom/` и задайте `YOLO_MODEL`.
Быстрый способ получить базовую модель:
```bash
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
cp yolov8n.pt official/shopguard_v1.pt
```
