# 📓 Журнал проекта — ShopGuard Platform

Читать в начале новой сессии. Продолжать работу по этапам, **не меняя архитектуру без
необходимости** (правила — в общих `PROJECT_RULES.md` проекта).

Дата: 2026-07-04

---

## Что это
Система предотвращения краж в магазине. Основана на **рабочем прототипе** `../shopguard/`
(Python: RTSP + YOLO + трекинг + зоны полок/выхода + логика кражи + распознавание лиц +
Telegram-алерты). Цель — превратить прототип в продукт: микросервисный backend + Flutter-приложение.

## Принятые решения (Этап 1)
- **Микросервисы с самого начала** (по требованию заказчика).
- **Только алерты + видеоклипы/снимки**, живого просмотра камер нет → нет отдельного
  RTSP-стриминг-сервиса (RTSP читается внутри `ai-detection`).
- **AI на CPU** сейчас (1-2 камеры), архитектура GPU-ready (stateless воркеры).
- **AI-сервис остаётся на Python** (YOLO), остальное — NestJS. Общий язык событий — через Redis Streams.
- Секреты вынести в `.env` (в прототипе захардкожены — Telegram-токен, RTSP-пароль).

## Сервисы (границы)
api-gateway · auth-service · user-service · camera-service · ai-detection(Python) ·
notification-service · storage-service. Общение: клиент↔gateway (REST/WS),
между сервисами — Redis. Детали — в [ARCHITECTURE.md](ARCHITECTURE.md).

## Сделано
- ✅ **Этап 1 — Архитектура**: ARCHITECTURE.md, README.md, структура, журнал.
- ✅ **Этап 2 — Backend (каркас)**: NestJS-монорепо `backend/` (webpack-сборка).
  - Сервисы: `gateway`(8080, HTTP) + `auth`(3001) `user`(3002) `camera`(3003)
    `notification`(3004) `storage`(3005) — каждый health `/api/health`, Redis-микросервис.
  - Общее: `libs/common`(bootstrap+health, без дублирования), `libs/contracts`(типы событий).
  - `ai-detection/` — Python-заготовка (health + Redis; YOLO — Этап 7).
  - `docker-compose.yml` (Postgres:5433, Redis:6380, MinIO:9100/9101 — порты смещены,
    чтобы не конфликтовать с CENTR FAYZ). Общий Dockerfile, команда на сервис.
  - **Проверено:** сборка `build:all` OK; gateway/auth/storage поднимаются, health=ok.
  - Решение: `webpack:true` + `deleteOutDir:false` в nest-cli (иначе алиасы не резолвятся /
    dist затирается между сборками).

- ✅ **Этап 3 — Авторизация**: микросервисный поток `gateway (HTTP) → Redis → auth`.
  - `auth`: register/login/refresh/logout/me; JWT access+refresh + **ротация** + отзыв;
    роли OWNER/GUARD; bcrypt; Prisma-схема `auth` (User, RefreshToken) + миграция `init`.
  - `gateway`: HTTP-контроллер `/api/auth/*` (ClientProxy→Redis), `JwtAuthGuard` (локальная
    проверка access-токена), `rpc()`-хелпер + `RpcHttpExceptionFilter` (сохранение HTTP-статусов).
  - Общее: `PrismaModule`, `ValidationPipe`, DTO-валидация.
  - **Проверено:** register→JWT, login(401 на неверный), дубль email(409), me(401 без токена),
    refresh-ротация, старый refresh(401). Всё через gateway :8080.
  - БД: пока в нативном Postgres :5432 (БД `shopguard`); в Docker — :5433.

- ✅ **Этап 4 — База данных**: добавлены домены (миграция `domain_schemas`, auth не тронут):
  - `Store`, `StoreStaff` (владелец↔охрана)
  - `Camera`, `Zone`(SHELF/EXIT), `BehaviorSettings` (пороги поведения)
  - `Event`(THEFT/BLACKLIST, статус NEW/REVIEWED/FALSE_ALARM, ключи клипа/снимка)
  - `BlacklistPerson` (имя, embedding лица, фото)
  - **Проверено:** миграция применена, 9 таблиц в БД, старые auth-таблицы целы.

- ✅ **Этап 5 — Flutter (каркас)**: приложение `mobile/` (Feature-First + BLoC/Cubit).
  - `core/`: `storage/token_storage` (flutter_secure_storage), `api/dio_client`
    (baseUrl из `--dart-define=API_URL`, авто-подстановка Bearer), `theme/app_theme`
    (тёмная тема), `widgets/placeholder_page`.
  - `features/auth`: model/repository/cubit/ui — экран входа-регистрации, поток к gateway
    `/api/auth/*`, токены в secure storage, **авто-восстановление сессии** (refresh+me) при старте.
  - `features/home`: `HomeShell` — нижняя навигация (Камеры/Алерты/История/Профиль).
  - `features/{cameras,alerts,history,settings}`: экраны-заглушки (наполнение — Этапы 6-9).
  - `features/profile`: данные пользователя + выход + вход в настройки.
  - `main.dart`: DI (storage→client→repo), `AuthCubit`, переключение LoginPage↔HomeShell по статусу.
  - **Проверено:** `flutter pub get` OK, `flutter analyze` — 0 ошибок, smoke-тест обновлён.
  - Решение: без live-видео (по Этапу 1) экраны камер/истории — списки алертов и клипов,
    а не плееры; наполним данными после появления camera/notification API (Этапы 6, 8-9).

- ✅ **Этап 6 — Камеры (RTSP)**: `camera-service` (Redis-микросервис) + маршруты gateway + экран Flutter.
  - Домены сервиса: **Store** (магазин — контейнер камер), **Camera**, **Zone**, **BehaviorSettings**
    (Prisma-модели с Этапа 4, новых миграций нет).
  - `camera-service`: `StoreService` (create/list своих), `CameraService` (CRUD камер, замена зон,
    upsert поведения, `configList` для ai-detection), `CryptoService` (**AES-256-GCM** для RTSP-URL).
  - **RTSP хранится зашифрованным** (`rtspUrlEnc`); ключ — `CAMERA_ENC_KEY`. В API камеры URL не отдаётся;
    расшифровка только в `CONFIG_LIST` (для ai-detection, Этап 7).
  - `gateway`: `/api/stores`, `/api/stores/:id/cameras`, `/api/cameras/:id` (+zones/behavior),
    все под `JwtAuthGuard` + роль **OWNER**; проверка владения магазином/камерой в сервисе.
  - Контракты: `libs/contracts/src/camera.ts` (CAMERA_PATTERNS + DTO/представления).
  - Flutter: экран «Камеры» — список камер магазина, добавление магазина/камеры (bottom-sheet),
    удаление, pull-to-refresh; статус Активна/Выключена (реальный online — с Этапа 7).
  - **Проверено:** сборка `build:all` OK; поток register→store→camera→zones→behavior→get→patch;
    изоляция доступа (чужой OWNER → **403**); RTSP в БД — шифртекст (без plaintext), расшифровка round-trips;
    `flutter analyze` — 0 ошибок.
  - Решение: **Store живёт в camera-service** (естественный владелец иерархии магазин→камеры),
    а не в отдельном store-service — БД общая (один `schema.prisma`), лишний сервис избыточен.
    Управление магазинами/камерами пока только для OWNER; доступ GUARD через `StoreStaff` — позже.
  - Фикс: хендлер, возвращавший `void`, ронял `firstValueFrom` (EmptyError) → `setBehavior`
    теперь возвращает сохранённые настройки.

- ✅ **Этап 7a — AI-ядро (детекция кражи)**: перенос логики прототипа в `ai-detection/` (Python).
  Разбит на 7a (ядро) и 7b (лица) по решению заказчика.
  - `app/redis_rpc.py` — **клиент request/reply к NestJS поверх Redis-транспорта** (канал `<pattern>`,
    ответ в `<pattern>.reply`). `protocol=2` (RESP2 — совместимость со старыми Redis). Так Python
    вызывает camera-service, не дублируя его логику/крипту.
  - `app/config_client.py` — тянет `camera.config.list` (RTSP уже расшифрован camera-service).
  - `app/zones.py` — точка-в-полигоне (ray casting), классификация SHELF/EXIT по центру бокса.
  - `app/theft_logic.py` — машина состояний трека (полка ≥dwell → выход ≥confirm = кража, кулдаун,
    сброс потерянных треков). Чистая логика, без внешних зависимостей.
  - `app/detector.py` — YOLOv8n + `track(persist=True)` (ByteTrack), только класс person.
  - `app/camera_worker.py` — поток на камеру: RTSP → детектор → зоны → логика → буфер кадров.
  - `app/storage.py` + `app/event_publisher.py` — снимок/клип в MinIO, событие в Redis Stream
    `detection.events` (форма = контракт `DetectionEvent`).
  - `main.py` — health + оркестратор: опрос конфига каждые N сек, старт/стоп/перезапуск воркеров
    по сигнатуре конфига. **Границы:** ai-detection НЕ шлёт Telegram/push и НЕ пишет в БД — только событие.
  - Docker: ffmpeg+libglib, веса YOLO качаются на этапе сборки (образ самодостаточен). compose:
    ai-detection получил S3-креды, `depends_on [redis, minio, camera]`.
  - **Проверено:** 7 юнит-тестов логики/зон (`tests/test_theft_logic.py`) — зелёные; `compileall` всех
    модулей — OK; **вживую**: Python→camera-service `CONFIG_LIST` вернул конфиг с расшифрованным RTSP;
    путь публикации — снапшот в MinIO (image/jpeg) + событие в стриме `detection.events` (поля контракта).
  - **Не проверено локально** (честно): полный YOLO+RTSP+ffmpeg-клип — нет колёс torch под Python 3.14;
    валидируется при сборке Docker (python:3.11) на реальной камере/видео.
  - Локальные детали: настоящий MinIO — на :9000 (общий с CENTR FAYZ, `minioadmin/minioadmin123`);
    порт :9100 занят посторонним процессом. В Docker — `minio:9000`.

- ✅ **Этап 7b — Лица / чёрный список**: распознавание лиц из ЧС магазина → событие `type=blacklist`.
  Решение заказчика — **лёгкий вариант**: эмбеддинги считаются в памяти ai-detection (не хранятся в БД).
  - Контракты: `BLACKLIST_CREATE/LIST/DELETE/CONFIG` + DTO/`BlacklistEntry` в `camera.ts`.
  - camera-service: `BlacklistService` (CRUD `BlacklistPerson` c проверкой владельца магазина) +
    `blacklist.config` (записи с фото для ai-detection). Схема БД не менялась.
  - gateway: `S3Service` (`@aws-sdk/client-s3`) — приём multipart-фото → MinIO (ключ);
    `BlacklistController`: POST `/api/stores/:id/blacklist` (name+photo), GET, DELETE `/api/blacklist/:id`
    (OWNER). gateway получил S3-env в compose.
  - ai-detection: `faces.py` (косинус + `FaceIndex`, чистая логика), `face_recognizer.py` (InsightFace
    buffalo_sc, ленивая загрузка, деградация без него), интеграция в `camera_worker` (кулдаун на человека),
    `event_publisher.publish_blacklist`, оркестратор строит индексы лиц по магазинам (кэш эмбеддингов
    по photoKey, раздаёт воркерам без рестарта). `storage.get` для скачивания фото.
  - Docker: +insightface/onnxruntime, предзагрузка модели buffalo_sc в образ.
  - **Проверено:** backend `build:all` OK; 5 юнит-тестов лиц + 7 прошлых — зелёные; `compileall` OK.
    **Вживую:** upload фото (multipart)→MinIO + `BlacklistPerson` (имя-кириллица целое); RPC
    `blacklist.config` вернул запись; `storage.get` скачал валидный JPEG (ffd8); событие `blacklist`
    в стриме с `personName`/`snapshotKey`; изоляция — чужой OWNER на list/delete → **403**.
  - **Не проверено локально** (как и YOLO в 7a): реальный InsightFace-эмбеддинг — нет колёс под 3.14,
    валидируется в Docker (python:3.11) на фото с лицом.
  - **Этап 7 (AI) полностью завершён.**

- ✅ **Этап 8 — WebSocket (живые тревоги)**: цепочка `стрим → БД → REST + WS → приложение`.
  - Контракты: `notification.ts` — `NOTIFICATION_PATTERNS` (events.list/status), `EventView`,
    `ALERTS_CHANNEL='alerts'`, `AlertPayload`.
  - notification-service: `StreamConsumer` (ioredis, consumer group `notification` на `detection.events`,
    XREADGROUP/XACK) → `EventService.persist` пишет `Event` (резолв камера→магазин) → публикует тревогу
    в Redis-канал `alerts`. `EventService.list/updateStatus` (проверка владельца). БД-схему не меняли.
  - gateway: REST `/api/stores/:id/events` (+`?status=`), `PATCH /api/events/:id/status` (OWNER),
    обогащение **presigned-ссылками** на снимок/клип (`S3Service.presign`, отдельный клиент с
    `S3_PUBLIC_ENDPOINT`). WebSocket `/ws/alerts` (`@nestjs/platform-ws`, `WsAdapter` через новый
    хук `configure` в bootstrap): JWT в `?token=`, подписка `{storeId}` с проверкой владения,
    раздача из канала `alerts` только владельцам магазина.
  - Flutter: `features/alerts` (модель/репозиторий/`AlertsSocket`(web_socket_channel)/cubit/UI) —
    лента новых тревог со снимком, live-приём по WS, действия «Просмотрено/Ложная»;
    `features/history` — все события со статусами (read-only, pull-to-refresh).
  - **Проверено вживую:** событие в стрим → `Event` в БД (резолв камеры, статус NEW) → REST отдаёт
    с presigned `snapshotUrl`; `PATCH` статуса + фильтр `?status=NEW`; **WS сквозняк** — подписка
    (проверка владения) → XADD → тревога `alert` пришла клиенту (Node ws-тест). `build:all` OK,
    `flutter analyze` — 0 ошибок.
  - Решение: WS живёт в gateway (единый edge), notification лишь публикует в Redis-канал; presigned-URL
    строятся на публичный адрес MinIO (`S3_PUBLIC_ENDPOINT`), т.к. внутренний `minio:9000` клиенту недоступен.

- ✅ **Этап 9 — Telegram-алерты** (9a; FCM отложен — нужен Firebase service-account заказчика).
  - Схема: у `Store` добавлено `telegramChatId String?` (миграция `store_telegram`).
  - Контракты: `STORE_SET_TELEGRAM`, `SetTelegramDto`, поле `telegramChatId` в `StoreView`.
  - camera-service: `StoreService.setTelegram` (проверка владельца). gateway: `PATCH /api/stores/:id/telegram`.
  - notification-service: `TelegramSender` (токен `TELEGRAM_BOT_TOKEN`, база `TELEGRAM_API_BASE` —
    конфигурируема для тестов) + `SnapshotStore` (чтение снимка из MinIO). `EventService.persist`
    теперь возвращает `{view, telegramChatId}`; `StreamConsumer` при наличии chatId шлёт в Telegram:
    **sendPhoto** (снимок из MinIO + подпись) либо **sendMessage** (если снимка нет). Best-effort, ошибки не роняют поток.
  - Flutter: экран «Настройки» — задать/очистить Telegram chat_id (`SettingsRepository`).
  - env: `TELEGRAM_BOT_TOKEN` в `.env.example` + compose (notification получил S3 + токен).
  - **Проверено вживую (mock Telegram API):** `PATCH telegram` сохранил chatId; событие со снимком →
    `sendPhoto` (multipart, chat_id/caption/photo); событие без снимка → `sendMessage` (JSON, верная
    подпись ЧС с именем). `build:all` OK, `flutter analyze` — 0 ошибок.
  - Секреты прототипа (BOT_TOKEN/CHAT_ID) в перенесённый код НЕ попали — только из `.env`.

- ✅ **Этап 10 — Тестирование**: автоматические unit-тесты (без внешней инфраструктуры, для CI).
  - Backend (**Jest**, `jest.config.js` + `npm test`): moduleNameMapper для `@app/*`, ts-jest.
    Спеки с мок-зависимостями (Prisma/Jwt/ConfigService — заглушки, без БД):
    `crypto.service.spec` (шифрование RTSP round-trip), `rpc-exception.filter.spec` (сохранение
    статусов 401/409/500), `rpc.util.spec`, `auth.service.spec` (409 дубль, 401 пароль, 403 блок),
    `camera.service.spec` (403/404 владение, RTSP не отдаётся), `event.service.spec` (маппинг/telegramChatId).
    **23 теста, 6 наборов — зелёные.**
  - AI (Python): `tests/test_theft_logic.py` (7) + `tests/test_faces.py` (5) — **12 тестов зелёные**.
  - Flutter: smoke-тест `PlaceholderPage` + `flutter analyze` = 0 (регресс-барьер).

- ✅ **Этап 11 — Docker (весь стек поднят и проверен)**.
  - Исправлено: **YAML** в compose (`${VAR:-default}` в inline-`{}` ломал парсер → блочный стиль
    у user/storage); **Prisma на Alpine musl** (`binaryTargets=linux-musl-openssl-3.0.x` + `openssl`/`libc6-compat`
    в образ); **ai-detection build** (нет компилятора для insightface/stringzilla → `build-essential`/`cmake`).
  - **Улучшение сборки:** CPU-only torch (`--index-url .../whl/cpu`) вместо CUDA-версии — −~1.8 ГБ,
    быстрее и легче (при CUDA-версии Docker Desktop падал по ресурсам).
  - При падении Docker Desktop восстановление: `wsl --shutdown` + перезапуск Docker Desktop; node-стек
    сам поднялся (`restart: unless-stopped`).
  - **Проверено вручную:** `docker compose up` — все **10 контейнеров** running (node-сервисы healthy);
    сквозной тест (register→store→camera→событие в контейнерный Redis→запись в БД→REST); ai-detection
    поднялся, загрузил модель, по Redis получил конфиг камеры и пошёл на RTSP (Connection refused —
    IP фиктивный, цепочка жива).

- ✅ **Улучшение AI: production-ready система моделей YOLO** (по запросу заказчика).
  - Путь к модели — **только через `YOLO_MODEL`** (нет хардкода; отсутствие → явная ошибка на старте).
    `MODELS_DIR` + структура `models/official/*.pt` и `models/custom/*.pt`.
  - `app/model_manager.py` `ModelManager`: валидация файла, метаданные (имя/версия/размер/время загрузки),
    вывод инфо-блока на старте, `switch()` с проверкой существования, `generation` для **hot-reload**,
    `create_detector()` (детектор на камеру — трекинг ByteTrack per-instance не ломается),
    `available()`. Загрузчик инъектируется (DIP) → тестируется без torch.
  - `Detector` принимает путь к весам (бизнес-логика `track` не тронута). Воркер берёт детектор у
    менеджера и **пересоздаёт при смене модели без перезапуска процесса**.
  - REST в ai-detection: `GET /ai/model`, `POST /ai/model/switch {model}` (404 с описанием, если файла нет).
  - Docker: базовая `shopguard_v1.pt`(=YOLOv8n) кладётся в `models/official` при сборке; `ENV YOLO_MODEL`;
    volume `./ai-detection/models/custom` — пользовательские модели без пересборки.
  - Документация: `ai-detection/MODEL_MANAGEMENT.md` (добавить/переключить/вернуть/проверить модель).
  - **Проверено:** `tests/test_model_manager.py` — **7 тестов зелёные**; `compileall` всех модулей OK.
    **На контейнере:** `GET /ai/model` → `{shopguard_v1.pt, v1, loaded}`; switch на несуществующую → **404**
    с перечислением путей; создание `shopguard_v2.pt` в `custom/` → switch → **v2** (резолв из custom + версия);
    возврат на v1 — ок.
  - Задел на будущее: A/B по магазинам (`create_detector` сможет принять model-override на магазин).

- ✅ **Этап 12.1a — Camera Management: модель + CRUD** (production).
  - Схема: у `Camera` добавлены `description, username, passwordEnc, manufacturer, model, location,
    status(enum ONLINE/OFFLINE/UNKNOWN), fps, resolution, lastOnline` (миграция `camera_management`).
  - **Креды отдельно от URL** (безопасность): `rtspUrl` хранится как база **без** логина/пароля;
    `username` — открыто, `password` — шифровано (`CryptoService`). Если URL со встроенными кредами —
    нормализуются (`splitCreds`/`parseRtsp`). Для AI `configList` собирает полный URL (`composeRtsp`).
    В API **пароль не отдаётся** (`hasPassword: boolean`); `rtspUrl` — только база без кредов.
  - Контракты: расширены `CameraView`/`Create/UpdateCameraDto`; `LIST_ALL`, `TEST`, `SNAPSHOT` паттерны;
    `CameraTestResult`.
  - API gateway: `GET /api/cameras` (все камеры владельца), `POST /api/cameras` (storeId в теле),
    `GET/PATCH/DELETE /api/cameras/:id` — новые поля проходят; старые `/stores/:id/cameras` не тронуты.
  - **Проверено:** `build:all` OK, **Jest 24 теста зелёные** (+ вынос кредов, пароль не отдаётся);
    на контейнерах — POST(URL с кредами→база без кредов, username вынесен, password скрыт) → GET(все)/
    GET(:id)/PATCH(disable+пароль отдельно)/DELETE. Миграция применилась к контейнерной БД.

- ✅ **12.1b — RTSP-тест + снапшот** (видео в ai-detection, оркестрация в camera-service).
  - ai-detection: `app/rtsp_probe.py` (test_stream — latency/fps/resolution, классификация ошибок
    Timeout/unavailable; grab_frame), `app/frame_registry.py` (потокобезопасный реестр последних кадров),
    внутренние HTTP-роуты `POST /internal/camera/test`, `POST /internal/camera/snapshot`
    (снапшот сначала берёт **кадр активного воркера**, иначе открывает разовое подключение).
    Таймаут ffmpeg через `OPENCV_FFMPEG_CAPTURE_OPTIONS` (tcp + stimeout 10с).
  - camera-service: `testCamera`/`snapshot` — расшифровка+сборка URL (`connectionUrl`), HTTP к ai-detection
    (`AI_DETECTION_URL`), запись `status/lastOnline/fps/resolution`. gateway: `POST /api/cameras/:id/test`,
    `GET /api/cameras/:id/snapshot` (отдаёт `image/jpeg`).
  - **Auto Detection вендора:** `rtsp_probe.detect_camera_info` — эвристика по пути RTSP
    (Hikvision/Dahua/Axis/Reolink/Uniview/Amcrest) + HTTP `Server`-заголовок (best-effort). Возвращается
    в тесте; camera-service пишет `manufacturer/model` **только если поле пустое** (ручной ввод не затирается).
    Не удалось определить → остаётся пустым.
  - **Проверено на контейнерах (офлайн И онлайн):** недоступная камера → `online:false/Timeout` + OFFLINE,
    снапшот → **503**; **онлайн (файл-поток 1280x720@25)** → `online:true, resolution 1280x720, fps 25`,
    статус ONLINE; **снапшот вернул реальный JPEG** (48 КБ); **reuse потока** — 2-й снапшот из активного воркера
    (лог «кадр из активного воркера», без 2-го подключения); **auto-detect** Hikvision по URL записан в БД.
- ✅ **12.1c — экспоненциальный backoff** в `camera_worker`: `RECONNECT_MIN/MAX` (2→4→…→60с),
  сброс при успехе, прерываемый `stop()`, сброс кадра из реестра при обрыве. Авто-восстановление.
  - **Проверено:** в логах рост интервала `2с→4с` по каждой камере независимо.
  - Фикс наблюдаемости: `PYTHONUNBUFFERED=1` в образе — Python-логи (модель/события/backoff) идут в docker logs.

- ✅ **12.1d — Flutter «Камеры»** (M3): переработана фича `features/cameras`.
  - `camera_models` (все поля + `CameraTestResult`), `camera_repository` (GET/POST/PATCH/DELETE `/cameras`,
    `/test`, `/snapshot`→bytes), `cameras_cubit` (все камеры владельца, поиск+фильтр All/Online/Offline,
    CRUD, вкл/выкл, тест с обновлением статуса, busyId).
  - UI: `cameras_page` (SearchBar, `SegmentedButton`-фильтр, RefreshIndicator, **skeleton** с пульсацией,
    **empty state**, FAB, обработка ошибок через SnackBar), `camera_card` (статус-точка 🟢/🔴/серый,
    имя, место, lastOnline, resolution/fps, Switch, действия Проверить/Превью/Изменить/Удалить),
    `camera_form_sheet` (форма всех полей, пароль на редактировании = «без изменений»),
    `snapshot_dialog` (превью кадра через bytes). Удалён осиротевший `add_camera_sheet`.
  - **Проверено:** `flutter analyze` — 0 ошибок, `flutter build web` — успешно. UI не запускался в эмуляторе
    (нет устройства), но эндпоинты совпадают с проверенными на бэкенде.

**Этап 12.1 (Camera Management) завершён полностью и проверен по всему чек-листу ТЗ**
(a: CRUD+модель, b: RTSP-тест+снапшот+auto-detect, c: backoff+авто-восстановление, d: Flutter M3).
- Тесты: **Jest 24** + **Python 36** (theft 7, faces 5, model 7, rtsp_probe/registry 6 + ранее) — зелёные.
- Ручная проверка на контейнерах: CRUD (все 5 эндпоинтов), RTSP-тест (офлайн+онлайн), снапшот (JPEG),
  reuse потока воркера, auto-detect вендора, backoff (2→4с), цепочка событий (AI→notification→REST) цела.
- Пересобраны образы: ai-detection, camera, gateway (backend). Ничего существующего не сломано.

- ✅ **Этап 12 — Деплой (compose + Caddy, авто-HTTPS)**.
  - `Caddyfile` — reverse proxy: `API_DOMAIN`→gateway:8080 (REST+WS), `FILES_DOMAIN`→minio:9000
    (presigned-ссылки). Авто-HTTPS Let's Encrypt (`ACME_EMAIL`).
  - `docker-compose.prod.yml` — оверлей: сервис `caddy` (80/443 наружу), у всех внутренних сервисов
    `ports: []` (host-порты закрыты, только внутренняя сеть), gateway `S3_PUBLIC_ENDPOINT=https://${FILES_DOMAIN}`,
    тома `caddy_data/config`.
  - `.env.production.example` (домены+секреты), `DEPLOY.md` (DNS→env→up, авто-миграции, сборка APK с
    прод `API_URL`, бэкапы, модели).
  - **Проверено:** слияние `docker compose -f ... -f docker-compose.prod.yml config` — OK (Caddy, домены,
    S3_PUBLIC_ENDPOINT, порты закрыты); функционально — Caddy `reverse_proxy → gateway` вернул health 200
    на сети compose. Реальный Let's Encrypt HTTPS — на публичном домене (задокументировано).
  - Kubernetes отложён (по плану «готово, но позже»): путь описан в `DEPLOY.md` (Deployment/Service +
    StatefulSet+PVC для БД/Redis/MinIO + Ingress/cert-manager). Непроверяемые манифесты не писал.
  - **Локальная прод-репетиция пройдена** (`.env.production` с `api.localhost`/`files.localhost`):
    Caddy взял **внутренний CA** для обоих доменов (issuer=local, без ACME); по HTTPS через Caddy —
    health gateway 200, полный auth-поток (register→JWT, me→user), 409 корректно проходит через edge;
    `files.localhost`→MinIO 403 (routing OK); host-порты внутренних сервисов закрыты, наружу только Caddy.
    Реальный деплой: заменить домены/секреты в `.env.production`, DNS на сервер — Caddy возьмёт Let's Encrypt.

**Все 12 этапов пройдены.** Продукт: микросервисный backend (NestJS) + AI (Python/YOLO/InsightFace) +
Flutter-приложение, поднимается локально и готов к прод-деплою (compose+Caddy).

- ✅ **A/B тестирование моделей YOLO** (коммерческий уровень).
  - Приоритет модели на камеру: **override магазина → canary(% по хэшу storeId) → default**.
  - Схема: `Store.modelOverride`, `Event.modelVersion` (миграция `ab_testing`).
  - camera-service: `StoreService.setModel` (валидация модели через ai-detection `GET /internal/models`),
    `configList` отдаёт `modelOverride`. gateway: `PATCH /api/stores/:id/model`, `GET /api/models`.
  - ai-detection: `app/ab_router.py` (детерминированный `md5(storeId)%100`), `ModelManager.create_detector(model_ref)`
    (модель на запрос + graceful fallback), env `AB_CANARY_MODEL`/`AB_CANARY_PERCENT`, `GET /internal/models`.
    Воркер берёт эффективную модель, `modelOverride` в сигнатуре (смена → рестарт только его камер),
    default-hot-reload не трогает закреплённые магазины.
  - **Сравнение качества:** события тегируются `modelVersion` (какая модель поймала) — сквозь ai-detection→
    стрим→notification→БД→REST (`EventView.modelVersion`).
  - **Тесты:** `test_ab_router.py` 7 (приоритет, детерминизм, доля ≈%, границы) — зелёные; Jest 24, Python 32.
  - **Проверено на контейнерах:** `GET /api/models` (v1,v2); `PATCH model` v2 → 200; невалидная → **400**
    со списком доступных; **воркер камеры магазина реально взял `shopguard_v2.pt`** (лог A/B); событие
    получило `modelVersion=v2`. Пересобраны: ai-detection, camera, gateway, notification, auth.
  - Заметка: миграции применяются при пересборке+рестарте `auth` (`prisma migrate deploy`); при итеративной
    разработке пересобирать auth, иначе колонка не появится в контейнерной БД.

- ✅ **Этап 14.1 — Event Engine** (ядро обобщённых событий, отдельно от алертного `Event`).
  - **Решение:** новая таблица `EventLog` (не трогаю рабочий алертный `Event`); новый микросервис
    **`event-service`** (SRP: notification=алерты/telegram/ws, event=движок); **Event Bus** = Redis Stream
    `events.stream` (событие — JSON в поле `data`).
  - Контракты `event.ts`: `EngineEventType` (9 типов), `EngineEvent` (базовый интерфейс), `EVENT_PATTERNS`,
    `ListEngineEventsDto`. Схема: `EventLog` (eventId/storeId/cameraId/trackingId/eventType/timestamp/
    confidence/modelVersion/metadata JSON/createdAt) + **5 индексов** (миграция `event_engine`).
  - `event-service`: `EventBus` (в `@app/common`, общий продюсер), `EventEngine` (consumer group →
    сохранение в `EventLog` → пайплайн **правил**), `EventStore` (list/get с owner-scoping),
    **расширяемая архитектура правил** (`EventRule`/`RuleContext` + реестр `RULES`).
    Правило `SuspiciousActivityRule`: ProductTaken(без Returned)+PersonExited → SuspiciousActivity (stateful, TTL).
  - Продюсеры: **ai-detection** (`app/event_bus.py`) — PersonDetected, ProductTaken, PersonExited (из
    сигналов `theft_logic`, рефактор → возвращает `Signals`), CameraOffline/CameraOnline (backoff/восстановление);
    **camera-service** — ModelSwitched (в `setModel`).
  - gateway: `GET /api/events` (фильтры storeId/cameraId/eventType/modelVersion/from/to/limit),
    `GET /api/events/:id` (OWNER).
  - **Тесты:** Jest **29** (+5 `suspicious-activity.rule.spec`), Python **33** (+1 `entered_exit`) — зелёные.
  - **Проверено на контейнерах:** публикация в шину → запись в `EventLog`; правило породило
    **SuspiciousActivity** (track 7, metadata derivedFrom); фильтр по типу; `GET /events/:id`; **ModelSwitched**
    от camera-service; **реальные `CameraOffline`** от воркеров ai-detection (9 в БД); 5 индексов на месте.
  - Пересобраны: ai-detection, event(new), auth(миграция), camera, gateway, notification.
  - Заметка: `PersonEntered`/`ProductReturned` — типы определены и движок их пишет; `ProductReturned`
    уже обрабатывается правилом (снимает подозрение); отдельные продюсеры этих двух — по мере надобности.

- ✅ **Этап 14.2 — Tracking Engine** (маршрут человека между камерами; на базе Event Engine).
  - **Модуль** в `event-service` (`tracking/`): своя **consumer group** `tracking-engine` на `events.stream`
    (не мешает `event-engine`). Потребляет `PersonDetected`/`PersonExited` (продюсеры ai-detection уже есть).
  - Схема: `PersonTrack` (id, trackingId, storeId, cameraId, enteredAt, exitedAt?, duration?, metadata, createdAt)
    + 5 индексов (миграция `person_track`).
  - `PersonTrackRepository` (open/findOpen/findOpenOnCamera/close/findMany/findById),
    `TrackingService` (onDetected → открыть/хэндофф; onExited → закрыть + duration; list/get owner-scoped),
    `TrackingEngine` (consumer). trackingId: из события, иначе генерируется (uuid).
  - **Хэндофф между камерами:** PersonDetected на другой камере при открытом сегменте → закрыть прошлый
    (metadata `handoff/toCamera`), открыть новый (`fromCamera`). Маршрут = сегменты с общим trackingId.
  - gateway: `GET /api/tracks` (фильтры storeId/cameraId/trackingId/active/from/to/limit), `GET /api/tracks/:id`.
  - **Тесты:** Jest **34** (+5 `tracking.service.spec`: open, no-op при открытом здесь, хэндофф, close+duration,
    no-op без открытого). Backend build OK.
  - **Проверено в Docker (integration):** человек #7 camA→camB→выход = **2 сегмента** (camA закрыт хэндоффом
    →camB, camB закрыт выходом, связка fromCamera/toCamera, duration); фильтр `active`; `GET /tracks/:id`;
    второй человек «в зале» → 1 активный. **Регрессий нет:** обе consumer-группы независимы, `EventLog`
    продолжает расти (Event Engine цел), 11 контейнеров работают.
  - Пересобраны: event, gateway, auth (миграция). ai-detection не менялся (продюсеры из 14.1).
  - Ограничение (честно): `trackingId` из ByteTrack — per-camera; истинная сшивка одного человека между
    камерами требует re-ID (лиц/эмбеддингов). Модель данных и логика хэндоффа **готовы** к общему trackingId;
    v1 корректно ведёт сегменты и связывает по общему id.

- ✅ **Этап 14.3 — Behavior Engine** (анализ поведения покупателей; на базе Event+Tracking Engine).
  - **Модуль** в `event-service` (`behavior/`): третья независимая **consumer group** `behavior-engine`
    на `events.stream`. Потребляет PersonDetected/Exited, ProductTaken/Returned, SuspiciousActivity;
    CameraOffline/Online/ModelSwitched — потребляются (ack), сессию не меняют.
  - Схема: `BehaviorSession` (id, trackingId, storeId, startedAt, endedAt?, duration?, visitedCameras JSON,
    productsTaken, productsReturned, riskScore, behaviorType, metadata JSON, createdAt) + 5 индексов
    (миграция `behavior_session`).
  - `RiskScorer` — **настраиваемые правила** (веса из env: `BEHAVIOR_W_UNRETURNED/SUSPICIOUS/QUICK_EXIT`,
    пороги): невозвращённые товары + подозрения + бонус за быстрый выход → 0..100; тип
    BROWSER/SHOPPER/SUSPICIOUS/THEFT_SUSPECT. `BehaviorSessionRepository`, `BehaviorService`
    (ensure/persist с live-пересчётом риска; onExited закрывает с финальным score), `BehaviorEngine`.
  - gateway: `GET /api/behavior` (фильтры storeId/behaviorType/minRiskScore/maxRiskScore/active/from/to/limit),
    `GET /api/behavior/:id`.
  - **Тесты:** Jest **49** (+15: `risk-scorer.spec` 10 — веса/clamp/типы; `behavior.service.spec` 5 —
    открытие/камеры/инкремент/закрытие с risk). Backend build OK.
  - **Проверено в Docker (integration):** покупатель (взял+вернул) → **SHOPPER risk 0**; вор
    (взял+подозрение+быстрый выход) → **THEFT_SUSPECT risk 90** (25+50+15), закрыт с duration/visitedCameras;
    фильтры THEFT_SUSPECT/minRiskScore=70/SHOPPER; `GET /:id`.
  - **Регрессий нет:** 3 независимые consumer-группы (event/tracking/behavior); от одного набора событий
    выросли все три таблицы (EventLog 28, PersonTrack 5, BehaviorSession 3); 11 контейнеров работают.
  - Пересобраны: event, gateway, auth (миграция). ai-detection не менялся.

- ✅ **Этап 14.4 — Purchase Matching Engine** (AI-корзина ↔ чек кассы, POS-агностично).
  - **Модуль** в `event-service` (`purchase/`): четвёртая независимая **consumer group** `purchase-matching`.
    Триггер — `PersonExited`: собирает AI-товары человека из `EventLog` (ProductTaken по trackingId в окне
    `PURCHASE_WINDOW_MINUTES`), запрашивает чек, сопоставляет.
  - Схема: `PurchaseSession` (id, trackingId, storeId, checkoutId, receiptId, status, confidence,
    aiProducts/receiptProducts/missingProducts/extraProducts JSON, metadata, createdAt) + 4 индекса
    (миграция `purchase_session`). Новый тип события `PurchaseMismatch`.
  - **POS-агностичность:** интерфейс `ReceiptProvider` + DI-токен `RECEIPT_PROVIDER`; пока `MockReceiptProvider`
    (детерминирован по trackingId; REGO не интегрируется). `PurchaseMatcher` — мультимножества товаров:
    MATCHED (полное) / PARTIAL_MATCH (частично) / NOT_MATCHED (нет пересечений), confidence = коэф. Дайса.
  - При PARTIAL_MATCH/NOT_MATCHED публикует `PurchaseMismatch` в шину (event-driven).
  - gateway: `GET /api/purchases` (фильтры storeId/checkoutId/status/minConfidence/maxConfidence/period),
    `GET /api/purchases/:id`.
  - **Тесты:** Jest **59** (+10: `purchase-matcher.spec` 6 — все статусы/confidence/мультимножества;
    `purchase.service.spec` 4 — MATCHED без публикации, PARTIAL/NOT_MATCHED с PurchaseMismatch, skip пустого).
  - **Проверено в Docker (integration):** MATCHED (conf 100), PARTIAL_MATCH (conf 86, missing [sku-4]),
    NOT_MATCHED (нет чека, conf 0); фильтры status/minConfidence; `GET /:id`; **2 события PurchaseMismatch**
    опубликованы (PARTIAL+NOT_MATCHED).
  - **Регрессий нет:** 4 независимые consumer-группы (event/tracking/behavior/purchase); от одного набора
    событий выросли все 4 таблицы (EventLog 46, PersonTrack 8, BehaviorSession 9, PurchaseSession 3);
    11 контейнеров работают. Пересобраны: event, gateway, auth (миграция). ai-detection не менялся.
  - Ограничение (честно): AI не классифицирует конкретные SKU — реальные ProductTaken дают обобщённые
    товары (матч по количеству). Матчер готов к идентификаторам товаров (будущий классификатор/POS-мэппинг);
    интеграционный тест использует именованные товары, как дал бы POS/классификатор.

- ✅ **Этап 14.5 — Alert Engine** (финальные решения из Behavior + Purchase).
  - **Модуль** в `event-service` (`alert/`): пятая независимая **consumer group** `alert-engine`.
    Триггеры — `PurchaseMismatch` (уже публикуется 14.4) и `CameraOffline`; `CameraOnline` потребляется (ack).
  - **Не менял** Behavior/Purchase Engine: `PurchaseMatched`/`BehaviorSessionClosed` не публикуются, поэтому
    Alert Engine **читает** актуальные `BehaviorSession`(riskScore)+`PurchaseSession`(status/confidence/id)
    из БД по trackingId. Кейс «MATCHED+низкий риск → без тревоги» — автоматически (MATCHED не даёт mismatch).
  - Схема: `AlertDecision` (id, trackingId?, storeId, alertType, severity, decision, riskScore?, confidence?,
    behaviorSessionId?, purchaseSessionId?, metadata, createdAt) + 4 индекса (миграция `alert_decision`).
    Новый тип события `AlertCreated`.
  - `AlertPolicy` — **конфигурируемые пороги** (`ALERT_RISK_THRESHOLD`, `ALERT_CAMERA_OFFLINE_SEVERITY`):
    высокий риск + (NOT_MATCHED|PARTIAL) → THEFT_ALERT; иначе SUSPICIOUS/нет. `AlertService`
    (соотнесение + создание + публикация `AlertCreated`), `AlertEngine`. **Уведомления не шлёт** — только событие.
  - gateway: `GET /api/alerts` (фильтры storeId/severity/alertType/period), `GET /api/alerts/:id`.
  - **Тесты:** Jest **69** (+10: `alert-policy.spec` 6 — все ветки решения/пороги; `alert.service.spec` 4 —
    THEFT_ALERT+AlertCreated, MATCHED без тревоги, риск 0, CameraOffline).
  - **Проверено в Docker (integration):** THEFT_ALERT HIGH (risk 90 Behavior + NOT_MATCHED Purchase, связаны
    behaviorSessionId+purchaseSessionId); CAMERA_OFFLINE MEDIUM; MATCHED-покупатель → **без тревоги**;
    фильтры severity/alertType; `GET /:id`; **2 события AlertCreated** опубликованы.
  - **Регрессий нет:** 5 независимых consumer-групп; от одного набора событий выросли все 5 таблиц
    (EventLog 72, PersonTrack 12, BehaviorSession 17, PurchaseSession 7, AlertDecision 2); 11 контейнеров.
  - Фикс сборки: в runner-стадию backend-образа добавлены `python3/make/g++` — `bcrypt` теперь собирается,
    если prebuilt недоступен (устраняет флейки-падения `npm install`). Пересобраны: event, gateway, auth.

- ✅ **Этап 15.1 — Mobile Architecture Audit** (Flutter → production-ready; backend не тронут).
  - **Аудит:** Feature-First + BLoC/Cubit + Repository + модели с fromJson — база здоровая. Найдены реальные
    проблемы (не переписывал с нуля, исправил точечно).
  - **Проблема 1 — DI не централизован (DIP):** `DioClient(TokenStorage())` создавался **ad-hoc в 5 местах**
    → 5 разных Dio-инстансов. Фикс: единые `TokenStorage`/`DioClient`/репозитории через `MultiRepositoryProvider`
    в `main.dart`; страницы берут `context.read<Repo>()`.
  - **Проблема 2 — нет refresh токена на 401 (функц. пробел):** access живёт 15м, обновлялся только при старте
    → середина сессии ломалась. Фикс: refresh-интерсептор в `DioClient` (ротация, защита от параллельных
    refresh через Completer, повтор запроса, `onSessionExpired` → выход в логин в `AuthCubit`).
  - **Проблема 3 — утечка WebSocket:** `AlertsSocket.connect` пересоздавал канал без закрытия старого
    (на каждый pull-to-refresh) → множ. соединения/дубли. Фикс: идемпотентный connect + сброс `_channel`
    при разрыве (переподключение возможно).
  - **Проблема 4 — мёртвый код:** удалён неиспользуемый `placeholder_page.dart` и зависимость `go_router`.
  - **Проверено OK (без изменений):** dispose Animation/Text-контроллеров, StreamController/Subscription
    (всё закрывается); токены в `flutter_secure_storage`; loading-состояния; обработка ошибок в cubit'ах.
  - **Тесты:** заменён сломанный smoke-тест на **5 unit-тестов моделей** (AuthResult/AlertEvent/CameraModel/
    CameraTestResult — парсинг + устойчивость к пустым полям).
  - **Результат:** `flutter analyze` — **0 проблем**; `flutter test` — **5 passed**; `flutter build web` — успешно.
    Изменённые файлы: `main.dart`, `core/api/dio_client.dart`, `auth/{data/auth_repository,cubit/auth_cubit}`,
    `alerts/{data/alerts_socket,ui/alerts_page}`, `cameras/ui/cameras_page`, `history/ui/history_page`,
    `settings/ui/settings_page`, `pubspec.yaml`, `test/widget_test.dart`; удалён `core/widgets/placeholder_page.dart`.
  - **Регрессий нет:** backend не менялся; UI и потоки данных те же, DI/безопасность/устойчивость улучшены.
  - **Self-review (тех-долг, НЕ исправлено намеренно — не нужно сейчас):**
    - Навигация switch-based — не масштабируется на deep-link/навигацию из push (Средняя) → роутер при появлении push.
    - Дублирование «первый магазин» (firstStore в 4 фичах) + нет общего StoreContext (Средняя) → shared StoreCubit при мультимагазинах.
    - `AlertsSocket` без авто-reconnect/backoff — live-алерты молча встают до refresh (Средняя) → heartbeat+backoff при проде.
    - Нет централизованного маппинга ошибок API (DRY try/catch по cubit'ам) (Низкая-средняя) → ApiException+mapper.
    - `FlutterSecureStorage` без явных Android/iOS-опций (Низкая-средняя, безопасность) → EncryptedSharedPreferences/accessibility.
    - UI завязан на один магазин (`stores.first`) (Низкая-средняя) → селектор магазина.
    - (Система) `EventLog.trackingId` Int, а прочие таблицы String → конвертации `Number()` (Низкая-средняя) → унифицировать String.
    - (Система) event-service: 5 движков масштабируются вместе; все группы читают все события (Низкая) → разделить сервисы при нагрузке.

- ✅ **Этап 15.2 — Backend Integration (data-слой)** (Flutter ↔ production API; backend не тронут).
  - **Область:** добавлен data-слой (репозитории + DTO) для доменов, у которых его ещё не было — 5 движков
    аналитики + AI-модели + магазины. Существующие Auth/Cameras/Alerts/History/Settings уже ходили в реальные
    API (15.1) — не трогал. **Новых UI-экранов не создавал** — это следующий этап (см. «Дальше»); репозитории
    зарегистрированы в DI и готовы к потреблению.
  - **Аудит эндпоинтов (перед кодом, чтобы не выдумывать API):** сверено с gateway-контроллерами. Все list-ручки
    движков возвращают **массив** View-объектов; фильтры взяты 1-в-1 из Query DTO backend.
  - **Новые репозитории (общий `DioClient` через DI, только чтение):**
    - `EventsEngineRepository` → `GET /api/events`, `/:id` (фильтры storeId/cameraId/eventType/from/to/limit).
    - `TrackingRepository` → `GET /api/tracks`, `/:id` (storeId/cameraId/trackingId/active/from/to/limit).
    - `BehaviorRepository` → `GET /api/behavior`, `/:id` (storeId/behaviorType/min-maxRiskScore/active/from/to/limit).
    - `PurchaseRepository` → `GET /api/purchases`, `/:id` (storeId/checkoutId/status/min-maxConfidence/from/to/limit).
    - `AlertDecisionsRepository` → `GET /api/alerts`, `/:id` (storeId/severity/alertType/from/to/limit).
    - `AiModelsRepository` → `GET /api/models` (`{available[], default}`).
    - `StoreRepository` → `GET /api/stores` (list) + `getById` **через список** (см. отсутствующий эндпоинт).
  - **DTO (`analytics_models.dart`):** `EngineEvent`, `PersonTrack`, `BehaviorSession`, `PurchaseSession`,
    `AlertDecision`, `AiModelsInfo` — имена полей сверены с `libs/contracts/src/event.ts`. `fromJson` устойчив:
    nullable/отсутствующие поля → безопасные дефолты, битые даты → эпоха (без исключений), enum-поля как
    **String** (forward-compat — неизвестный `status`/`severity`/`behaviorType` не роняет парсинг). `StoreModel`
    расширен полями `StoreView` (telegramChatId/modelOverride/createdAt), `name` сделан null-safe. **toJson не
    добавлял** — ответы только для чтения.
  - **Отсутствующие эндпоинты (НЕ выдуманы, зафиксировано):**
    - `GET /api/stores/:id` (детали одного магазина) — **нет**. `StoreRepository.getById` берёт из списка `/stores`
      (ответ уже содержит все поля магазина). `@Get(':id')` в `cameras.controller.ts:146` принадлежит
      `@Controller('cameras')`, а не `stores`.
    - `GET /api/models/:id` — **нет**, только список.
  - **DI:** новые репозитории добавлены в `MultiRepositoryProvider` (`main.dart`) через **общий** `DioClient` —
    новых `DioClient`/`TokenStorage` не создавал, Singleton остался Singleton.
  - **Обработка ошибок/токены:** используется существующий `DioClient` — Bearer, refresh-on-401 с ротацией и
    защитой от параллельных refresh, повтор исходного запроса, `onSessionExpired` → выход. 401/403/404/409/422/500/
    timeout/no-internet пробрасываются как `DioException` без падения приложения (единый механизм из 15.1).
  - **Кэш:** отдельного кэш-слоя в проекте нет — новый в рамках этапа **не реализовывал** (по ТЗ).
  - **Тесты:** `test/analytics_models_test.dart` — **8 unit-тестов** (полный объект + устойчивость к null/битым
    датам/неизвестным enum по каждому DTO + расширенный `StoreModel`).
  - **Результат:** `flutter clean` → `pub get` → `flutter analyze` — **0 проблем**; `flutter test` — **13 passed**
    (8 новых + 5 из 15.1). Существующие экраны не затронуты (UI не менялся, `StoreModel` расширен обратимо).
  - **Self-review / риски:**
    - **Репозитории движков пока не потребляются UI** — зарегистрированы в DI (не dead-code), экраны с
      Loading/Error/Empty/Success — предмет следующего этапа. Осознанная граница data-слоя.
    - Лёгкое дублирование `/stores`: `StoreRepository.list` и `CameraRepository.listStores` (наследие фичи camera).
      Оставлено как есть (surgical); при появлении общего StoreContext — объединить.
    - `getById` магазина = O(n) выборка из списка (нет серверного `/:id`) — приемлемо для малого числа магазинов.
  - **Регрессий нет:** backend/REST/архитектура не менялись; добавлен только data-слой.

## Дальше (опционально / по запросу)
- ⏭️ **15.3 — UI аналитики:** экраны для Events/Tracking/Behavior/Purchase/Alert-decisions/Models поверх готовых
  репозиториев (состояния Loading/Error/Empty/Success, cubit'ы). Data-слой уже в DI.
- ⏭️ **9b — FCM push** (нужен Firebase service-account заказчика).
- ⏭️ **Kubernetes-манифесты** (на реальном кластере).
- 💡 multi-stage ai-detection (образ 4.16 ГБ) — ужать; уменьшить латентность RTSP-теста (~20-25с на мёртвом IP).
- 💡 Flutter-админка A/B: экран выбора модели магазина (`GET /api/models` + `PATCH /stores/:id/model`).
- ⚠️ RTSP-пароли из прототипа (`Yolo/yolo.py`) — только через camera-service (уже шифруются), в код не хардкодить.

## Ссылки на существующее
- Прототип детекции: `../shopguard/Yolo/yolo.py` (монолит, рабочий)
- Модульная заготовка: `../shopguard/src/{camera,detection,tracking,...}`
- Конфиг: `../shopguard/config.yaml`, веса: `../yolov8n.pt`
