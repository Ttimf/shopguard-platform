# Безопасное подключение удалённого AI-воркера (VPN)

Как запустить `ai-detection` на отдельном ПК / GPU-сервере и **безопасно**
соединить его с VPS, **не открывая Redis и MinIO в Интернет**.

## Модель безопасности

- AI-воркер соединяется с VPS **только по VPN** (WireGuard или Tailscale).
- Redis и MinIO публикуются **только на интерфейсе VPN** (`VPN_BIND_IP`), а не на
  `0.0.0.0` → из Интернета недоступны. Наружу торчит только Caddy (443, HTTPS).
- Пароль Redis и ключи MinIO — обязательны в дополнение к VPN.
- VPN сам шифрует трафик, поэтому app-level TLS не требуется (опционален — см. ниже).

```
[AI-воркер (дом, RTX)]  --VPN(WireGuard/Tailscale)-->  [VPS]
   Redis  → 10.8.0.1:6379 (VPN)      Redis/MinIO слушают ТОЛЬКО на VPN-интерфейсе
   MinIO  → 10.8.0.1:9000 (VPN)      camera-service → AI:8000 (по VPN)
```

## Вариант A — WireGuard

**На VPS:**
```bash
apt install -y wireguard
wg genkey | tee vps.key | wg pubkey > vps.pub
cat >/etc/wireguard/wg0.conf <<'EOF'
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = <VPS_PRIVATE_KEY>
[Peer]                      # AI-воркер
PublicKey = <AI_PUBLIC_KEY>
AllowedIPs = 10.8.0.2/32
EOF
ufw allow 51820/udp         # только порт WireGuard наружу
wg-quick up wg0
```

**На AI-ПК:**
```bash
apt install -y wireguard
wg genkey | tee ai.key | wg pubkey > ai.pub
cat >/etc/wireguard/wg0.conf <<'EOF'
[Interface]
Address = 10.8.0.2/24
PrivateKey = <AI_PRIVATE_KEY>
[Peer]                      # VPS
PublicKey = <VPS_PUBLIC_KEY>
Endpoint = <VPS_PUBLIC_IP>:51820
AllowedIPs = 10.8.0.1/32
PersistentKeepalive = 25
EOF
wg-quick up wg0
ping 10.8.0.1               # проверка связи по VPN
```
→ `VPN_BIND_IP=10.8.0.1`, на AI в `.env`: `REDIS_HOST=10.8.0.1`, `AI_S3_ENDPOINT`/`S3_ENDPOINT=http://10.8.0.1:9000`.

## Вариант B — Tailscale (проще)

**На VPS и на AI-ПК:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up                # авторизоваться в одной tailnet
tailscale ip -4             # адрес узла, напр. 100.101.102.103
```
→ `VPN_BIND_IP=<Tailscale-IP VPS>`, на AI в `.env`: `REDIS_HOST=<Tailscale-IP VPS>`,
`S3_ENDPOINT=http://<Tailscale-IP VPS>:9000`.

## Запуск на VPS (Redis/MinIO только на VPN)

```bash
VPN_BIND_IP=10.8.0.1 docker compose \
  -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.vpn.yml \
  --env-file .env.production up -d
```
- `docker-compose.prod.yml` закрывает все host-порты (только Caddy 80/443).
- `docker-compose.vpn.yml` открывает **Redis (6379) и MinIO (9000) только на `VPN_BIND_IP`**.
- Проверка (единственные внешние порты — 80/443; Redis/MinIO — на VPN-IP):
  `docker compose ... config | grep -E "host_ip|published"`.
- camera-service должен звать AI по VPN: env `AI_DETECTION_URL=http://10.8.0.2:8000`.

## Запуск AI-воркера (на домашнем ПК)

```bash
cd ai-detection
cp .env.example .env         # заполнить REDIS_HOST/S3_ENDPOINT адресами VPN
docker compose -f docker-compose.standalone.yml --env-file .env up -d --build
```

## Опциональный TLS (если без VPN — не рекомендуется)

- **Redis:** включить TLS-порт на сервере Redis, затем на AI: `REDIS_TLS=true`
  (`REDIS_TLS_INSECURE=true` для self-signed). По умолчанию выкл — обратная совместимость.
- **MinIO:** указать `S3_ENDPOINT=https://...` — boto3 использует TLS автоматически.

## Firewall (VPS)

```bash
ufw default deny incoming
ufw allow 22/tcp            # SSH
ufw allow 80,443/tcp        # Caddy (HTTPS)
ufw allow 51820/udp         # WireGuard (для варианта A; Tailscale порт не нужен)
ufw enable
```
Redis/MinIO/Postgres/сервисы наружу **не открываются** — только через VPN-интерфейс.
