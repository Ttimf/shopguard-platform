# ai-detection — независимый запуск

Сервис видеоаналитики (Python + YOLO/InsightFace). Может работать **на VPS в
общем стеке** (главный `docker-compose.yml`) **или отдельно** — на домашнем ПК
или GPU-сервере, подключаясь к Redis/MinIO на VPS. **Код менять не нужно** — все
адреса берутся из переменных окружения (см. `.env.example`).

## Как сервис общается с остальной системой
- **Конфиг камер** (RTSP, зоны, поведение) — тянет сам через Redis RPC
  (`camera.config.list`) у camera-service. Исходящее подключение к Redis.
- **События** — пишет в Redis Streams `events.stream` и `detection.events`.
- **Снимки/клипы** — грузит напрямую в MinIO (S3).
- **Проверка камеры / снапшот** — принимает HTTP от camera-service на `PORT`
  (по умолчанию 8000). Для этих функций VPS должен достучаться до этого порта.

> Рекомендуется соединять отдельный AI-узел с VPS через приватную сеть (VPN,
> напр. WireGuard/Tailscale), а не публиковать Redis/MinIO в интернет.

## Подготовка
```bash
cp .env.example .env
# заполнить REDIS_HOST / REDIS_PASSWORD / S3_ENDPOINT / S3_* адресами VPS
```

## Способы запуска (без изменения кода)

**1. Автономный Docker Compose (рекомендуется, с GPU):**
```bash
docker compose -f docker-compose.standalone.yml --env-file .env up -d --build
```

**2. `docker run` (GPU):**
```bash
docker build -t shopguard-ai .
docker run -d --gpus all --env-file .env -p 8000:8000 \
  -v "$PWD/models/custom:/app/models/custom" shopguard-ai
```

**3. `python main.py` (локально, нужен Python 3.11 + ffmpeg + зависимости):**
```bash
pip install -r requirements.txt
set -a; . ./.env; set +a      # загрузить переменные окружения
python main.py
```

**4. В общем стеке на VPS** — как обычно, через главный `docker-compose.yml`
(там адреса Redis/MinIO по умолчанию — внутренние имена; переопределяются
переменными `AI_REDIS_HOST` / `AI_REDIS_PORT` / `AI_S3_ENDPOINT`).

## Проверка GPU
```bash
docker exec <container> python -c "import torch; print(torch.cuda.is_available())"
```

Управление моделями — см. `MODEL_MANAGEMENT.md`.
