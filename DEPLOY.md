# Развёртывание ShopGuard (production)

Прод-стек поднимается через docker-compose + **Caddy** (авто-HTTPS Let's Encrypt).
Наружу открыт только Caddy (80/443); все сервисы общаются по внутренней docker-сети.

## 1. Требования
- Сервер с Docker + docker compose, публичный IP.
- Два DNS-записи A/AAAA на этот IP:
  - `API_DOMAIN` — API + WebSocket (напр. `api.shopguard.example.com`)
  - `FILES_DOMAIN` — файлы MinIO для presigned-ссылок (напр. `files.shopguard.example.com`)
- Открытые порты 80 и 443.

## 2. Конфигурация
```bash
cp .env.production.example .env.production
# заполнить домены, e-mail и все секреты (openssl rand -base64 48)
```

## 3. Запуск
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --env-file .env.production up -d --build
```
- Caddy сам получит TLS-сертификаты для обоих доменов (нужен доступ извне по 80/443).
- Миграции БД применяются автоматически (сервис `auth` выполняет `prisma migrate deploy` при старте).

## 4. Проверка
```bash
curl https://API_DOMAIN/api/health          # {"service":"gateway","status":"ok"}
docker compose ... ps                         # все контейнеры healthy
```

## 5. Мобильное приложение
Собрать с продовым адресом API:
```bash
flutter build apk --dart-define=API_URL=https://API_DOMAIN/api
```
WebSocket-адрес выводится из `API_URL` автоматически (`wss://API_DOMAIN/ws/alerts`).

## 6. Данные и бэкапы
- Тома: `pg_data` (Postgres), `minio_data` (снимки/клипы), `caddy_data` (сертификаты).
- Регулярный бэкап: `docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB`.

## 7. Модели YOLO
Официальная `shopguard_v1.pt` уже в образе ai-detection. Пользовательские модели —
в `./ai-detection/models/custom/` (примонтировано), переключение — `POST /ai/model/switch`
(см. `ai-detection/MODEL_MANAGEMENT.md`).

## 8. Kubernetes (позже)
Для кластера каждый сервис → Deployment + Service, Postgres/Redis/MinIO — StatefulSet + PVC,
секреты → Secret, внешний доступ → Ingress (nginx/traefik) с cert-manager вместо Caddy.
Реализуется на реальном кластере (текущий прод-путь — compose + Caddy выше).
