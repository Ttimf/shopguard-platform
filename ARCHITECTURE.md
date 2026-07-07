# 🏛️ ShopGuard — Архитектура (Этап 1)

Система предотвращения краж в магазине: камеры (RTSP) → AI-детекция (YOLO) →
события/кражи → бэкенд → уведомления в приложение + Telegram.

**Решения (согласованы):**
- Микросервисы с самого начала
- Только **алерты + видеоклипы/снимки** (живого просмотра камер нет → нет стриминга RTSP→мобайл)
- AI на **CPU** сейчас, архитектура **GPU-ready**
- Clean Architecture, модульность, без дублирования, миграции БД, Docker per-service

---

## 1. Общая схема

```
   📷 RTSP-камеры
        │ (читает потоки)
challenge▼
┌─────────────────────────────┐
│   ai-detection (Python+YOLO) │  детекция, трекинг, зоны, логика кражи, лица
│   [GPU-ready, 1..N воркеров]  │
└───────────────┬─────────────┘
                │ события (Redis Streams: "events")
┌───────────────▼──────────────────────────────────────────┐
│                     BACKEND (NestJS микросервисы)          │
│                                                            │
│  ┌────────────┐   внутренняя шина (Redis transport)        │
│  │ api-gateway│◄──► auth · user · camera · notification ·  │
│  │ REST + WS  │      storage                                │
│  └─────┬──────┘                                             │
└────────┼───────────────────────────────────────────────────┘
   REST  │  WebSocket (live-алерты)          ┌──────────────┐
         └──────────────────────────────────►│ 📱 Flutter    │
                                              │ Feature-First│
   PostgreSQL (данные)   Redis (шина/кэш)     │ + BLoC       │
   S3/MinIO (клипы)      FCM (push)           └──────────────┘
```

**Поток события:** камера → `ai-detection` обнаружил кражу → кладёт событие + клип →
клип в S3, событие в Redis Stream → `notification-service` читает → сохраняет в БД,
шлёт push (FCM) + Telegram + пушит по WebSocket в приложение (если открыто).

---

## 2. Сервисы (границы и ответственность)

| Сервис | Стек | Ответственность | Своя БД-схема |
|--------|------|-----------------|---------------|
| **api-gateway** | NestJS | Единая точка входа (REST + WebSocket), проверка JWT, маршрутизация к сервисам | — |
| **auth-service** | NestJS | Регистрация/вход, JWT (access/refresh), роли (owner/guard) | `auth` |
| **user-service** | NestJS | Профили, магазины/объекты, привязка сотрудников | `users` |
| **camera-service** | NestJS | CRUD камер, RTSP-URL (шифр.), зоны (полки/выход), настройки поведения | `cameras` |
| **ai-detection** | **Python + YOLO** | Чтение RTSP, детекция, трекинг (ByteTrack), зоны, логика кражи, лица (чёрный список). Публикует события | `detection` (read-only конфиг из camera-service) |
| **notification-service** | NestJS | Приём событий из Redis, запись истории, push (FCM) + Telegram + WebSocket | `events` |
| **storage-service** | NestJS + S3 | Загрузка/выдача клипов и снимков событий (presigned URL) | — |

> **RTSP «Service»** из общего плана здесь **не отдельный сервис**: раз живого видео нет,
> чтение RTSP выполняется внутри `ai-detection`. Отдельный стриминг добавим, только если
> позже понадобится живой просмотр (граница уже готова).

**Правило независимости:** сервисы общаются только через API Gateway (клиент) и
Redis-шину (между собой). Прямых зависимостей «сервис импортирует сервис» нет.

---

## 3. Взаимодействие

| Канал | Кто | Зачем |
|-------|-----|-------|
| **REST** (через gateway) | Flutter ↔ backend | вход, список камер, история, настройки |
| **WebSocket** (через gateway) | backend → Flutter | live-алерты о кражах в реальном времени |
| **Redis Streams** | ai-detection → notification | события детекции (кража, чёрный список) |
| **Redis transport** | gateway ↔ сервисы | внутренние вызовы (NestJS microservices) |
| **FCM push** | notification → телефон | уведомление, когда приложение закрыто |
| **Telegram** | notification → чат | дублирование алертов (как в прототипе) |

---

## 4. База данных (PostgreSQL, миграции)

DB-per-service (логические схемы в одном инстансе на старте; легко вынести в отдельные БД).
Проектируем так, чтобы новые функции = новые таблицы/поля, без ломки существующих.

- **auth**: `users_auth(id, phone, password_hash?, role, created_at)`, `refresh_tokens(...)`
- **users**: `profiles(id, auth_id, name, ...)`, `stores(id, owner_id, name, address)`, `store_staff(store_id, user_id, role)`
- **cameras**: `cameras(id, store_id, name, rtsp_url_enc, enabled, fps_limit)`, `zones(id, camera_id, type[shelf|exit], polygon)`, `behavior_settings(camera_id, shelf_dwell_s, exit_confirm_s)`
- **events**: `events(id, camera_id, type[theft|blacklist], track_id, confidence, clip_key, snapshot_key, created_at)`, `event_status(event_id, status[new|reviewed|false_alarm], reviewed_by)`
- **detection**: `blacklist(id, store_id, name, face_embedding, photo_key)`

---

## 5. Структура проекта (монорепо)

```
shopguard-platform/
├── README.md · ARCHITECTURE.md · PROJECT_PROGRESS.md
├── docker-compose.yml            # весь стек локально
├── .env.example
├── libs/
│   └── contracts/                # общие DTO/типы событий (event schema)
├── gateway/                      # NestJS API Gateway (REST + WS)
├── services/
│   ├── auth-service/             # NestJS (Clean Architecture)
│   ├── user-service/             # NestJS
│   ├── camera-service/           # NestJS
│   ├── notification-service/     # NestJS
│   ├── storage-service/          # NestJS + S3
│   └── ai-detection/             # Python + YOLO (рефакторинг shopguard/)
│       └── src/{camera,detection,tracking,zones,events,face,config}
└── mobile/                       # Flutter (Feature-First + BLoC)
    └── lib/features/{auth,home,cameras,alerts,history,profile,settings}
```

Каждый NestJS-сервис: `src/{domain,application,infrastructure,presentation}` + свой `Dockerfile`.
`ai-detection`: модульный (переносим логику из работающего `shopguard/Yolo/yolo.py`).

---

## 6. Масштабирование (заложено сразу)
- **ai-detection** — stateless воркеры: 1 процесс на камеру/группу; добавил GPU/сервер → запустил ещё воркеры (без изменения кода). Конфиг камер — из camera-service.
- **backend-сервисы** — stateless (сессии в JWT/Redis) → горизонтально масштабируются.
- **Готовность к Kubernetes**: каждый сервис — отдельный контейнер с health-check; K8s внедряем позже (сейчас docker-compose).

---

## 7. Безопасность
- Секреты (Telegram-токен, пароли RTSP, JWT) — только в `.env`/секретах, **не в коде**
  (в прототипе сейчас захардкожены — исправим при переносе).
- RTSP-URL в БД — шифруются.
- JWT + роли (owner/guard) на gateway.
- S3-клипы — доступ по presigned URL, не публично.

---

## 8. Что дальше (план этапов)
1. ✅ **Этап 1 — Архитектура** (этот документ)
2. ⏭️ **Этап 2 — Backend**: каркас gateway + сервисов + docker-compose (Postgres/Redis/MinIO)
3. Этап 3 — Авторизация (auth-service + JWT)
4. Этап 4 — База данных (миграции всех схем)
5. Этап 5 — Flutter (Feature-First каркас)
6. Этап 6 — Камеры (camera-service + чтение RTSP в ai-detection)
7. Этап 7 — AI детекция (перенос YOLO-логики в ai-detection)
8. Этап 8 — WebSocket (live-алерты)
9. Этап 9 — Push (FCM) + Telegram
10. Этап 10 — Тестирование
11. Этап 11 — Docker (финализация)
12. Этап 12 — Деплой

> Не переходим к следующему этапу, пока текущий не завершён и не проверен.
