# 🛡️ ShopGuard Platform

Система предотвращения краж в магазине на базе видеоаналитики (YOLO).
Камеры (RTSP) → AI-детекция → события/кражи → уведомления в мобильное приложение + Telegram.

## Стек
Flutter (моб.) · NestJS (микросервисы) · Python + YOLO (AI) · PostgreSQL · Redis ·
S3/MinIO · Docker · JWT · WebSocket · FCM

## Возможности (целевые)
- Детекция людей, трекинг (ByteTrack), зоны полок/выхода
- Логика подозрения на кражу (был у полки → вышел без оплаты)
- Распознавание лиц (чёрный список)
- Алерты в приложение (push + WebSocket) и Telegram с видеоклипом события
- Управление камерами, зонами, историей событий из приложения

## Документы
- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура, сервисы, схема данных
- [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) — журнал (читать в начале сессии)

## Структура
```
gateway/           API Gateway (REST + WebSocket)
services/          auth · user · camera · notification · storage · ai-detection
mobile/            Flutter (Feature-First)
libs/contracts/    общие DTO/схемы событий
docker-compose.yml весь стек локально
```

## Запуск (появится по мере сборки — Этап 2+)
```bash
docker compose up -d      # Postgres + Redis + MinIO + сервисы
```

## Статус
Этап 1 (архитектура) — ✅. Дальше — Этап 2 (каркас backend). См. PROJECT_PROGRESS.md.
