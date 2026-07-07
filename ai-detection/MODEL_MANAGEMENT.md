# Управление моделями YOLO — ShopGuard

AI-сервис загружает модель **только** через переменную окружения `YOLO_MODEL`.
В коде нет захардкоженных путей. Управляет моделями `app/model_manager.py` (`ModelManager`).

## Структура
```
ai-detection/models/
  official/   # официальные модели ShopGuard (в образе)
    shopguard_v1.pt
    shopguard_v2.pt
  custom/     # дообученные модели заказчика (volume, без пересборки)
    customer_model_001.pt
```

`ModelManager` ищет модель по имени в: `<путь как есть>`, `models/<имя>`,
`models/official/<имя>`, `models/custom/<имя>`.

## Переменные окружения
| Переменная | Назначение | Пример |
|-----------|-----------|--------|
| `YOLO_MODEL` | текущая модель (обязательно) | `models/official/shopguard_v1.pt` |
| `MODELS_DIR` | корень моделей | `models` |
| `YOLO_DEVICE` | `cpu` или индекс GPU | `cpu` |

Если `YOLO_MODEL` не задан — сервис падает с понятной ошибкой на старте.

## Как добавить новую модель
1. Официальная: положить `shopguard_v2.pt` в `models/official/` (в образ — при сборке,
   либо `docker cp` в контейнер).
2. Пользовательская: положить `.pt` в `ai-detection/models/custom/` на хосте —
   она сразу доступна в контейнере (примонтирована как volume), пересборка не нужна.

## Как переключиться на другую модель (без изменения кода)
```bash
curl -X POST http://localhost:8000/ai/model/switch \
  -H "Content-Type: application/json" \
  -d '{"model":"shopguard_v2.pt"}'
```
Ответ:
```json
{ "currentModel": "shopguard_v2.pt", "version": "v2", "loaded": true }
```
Переключение — «горячее»: воркеры камер пересоздают детектор без перезапуска процесса.
Если файла нет — вернётся ошибка `404` с описанием, где искали.

## Как вернуть старую модель
```bash
curl -X POST http://localhost:8000/ai/model/switch \
  -H "Content-Type: application/json" \
  -d '{"model":"shopguard_v1.pt"}'
```
Либо задать `YOLO_MODEL` на нужную модель и перезапустить сервис.

## Как проверить текущую модель
```bash
curl http://localhost:8000/ai/model
# { "currentModel": "shopguard_v1.pt", "version": "v1", "loaded": true }
```
Также при старте сервис печатает имя, версию, размер и время загрузки модели.

## На будущее
- **Hot reload** уже реализован через `generation` в `ModelManager` (воркеры следят за сменой).
- **A/B по магазинам**: `create_detector()` спроектирован так, что позже сможет принимать
  модель-override на магазин — 10% магазинов на `shopguard_v2.pt`, остальные на `v1`,
  без влияния на общий поток.
