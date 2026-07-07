# Один образ на все NestJS-сервисы; конкретный сервис задаётся командой в compose:
#   command: node dist/apps/<service>/main.js
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate
COPY . .
RUN npm run build:all

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# python3/make/g++ — чтобы нативные модули (bcrypt) собрались, если prebuilt
# недоступен; openssl/libc6-compat — для Prisma.
RUN apk add --no-cache openssl libc6-compat python3 make g++
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
COPY --from=builder /app/dist ./dist
# по умолчанию — gateway; остальные сервисы переопределяют command в compose
CMD ["node", "dist/apps/gateway/main.js"]
