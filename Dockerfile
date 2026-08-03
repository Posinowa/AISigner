FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build sırasında Next "page data" toplarken route modülleri import edilir; bu
# PrismaClient'ı kurar ve nextauth modülü AUTH_SECRET guard'ını çalıştırır
# (build NODE_ENV=production altında koşar). Gerçek bağlantı/oturum kurulmaz; bu
# YER TUTUCU değerler yalnızca bu RUN komutu süresince tanımlıdır — imaja/ENV'e
# yazılmaz, runner stage'e taşınmaz. Runtime'da gerçek değerler kullanılır.
# (AUTH_SECRET NEXT_PUBLIC_ değildir; client bundle'a da gömülmez.)
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    AUTH_SECRET="build-time-placeholder-not-used-at-runtime" \
    npm run build -- --no-lint

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# GÜVENLİK: konteyner root olarak koşmasın (savunma-derinliği). node:20 imajında
# hazır gelen 'node' (uid 1000) kullanıcısına geçiyoruz. uploads klasörü + tüm
# /app node'a devrediliyor ki entrypoint gcp-credentials.json'ı yazabilsin ve
# öğrenci dosya yüklemeleri çalışsın.
RUN chmod +x ./docker-entrypoint.sh \
    && mkdir -p /app/uploads \
    && chown -R node:node /app

USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
