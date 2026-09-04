FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# --- Bağımlılıklar -----------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `npm ci` (öncesi `npm install`): lockfile'ı AYNEN kurar ve onu değiştirmez.
# `npm install` lockfile'ı yok sayıp sürümleri yeniden çözebiliyordu — yani
# imaj, CI'ın test ettiğinden farklı bağımlılıklarla çıkabilirdi. CLAUDE.md
# zaten CI'ın npm 10 + `npm ci` kullandığını yazıyor; imaj artık onunla aynı.
RUN npm ci

# --- Migration araçları -------------------------------------------------------
# Prisma CLI'yi TEK BAŞINA, boş bir ağaca kuruyoruz.
#
# İki yanlış denemeden sonra buradayız:
#  1) CLI klasörlerini tek tek kopyalamak (`prisma`, `@prisma`, `.prisma`) →
#     konteyner "Cannot find module 'effect'" ile çöktü. CLI'nin transitive
#     bağımlılıkları sürümle değişiyor, elle seçilemez.
#  2) Tüm production `node_modules`'ünü kopyalamak → çalıştı ama imaj 1.16 GB'dan
#     3 GB'a çıktı; standalone'un sağladığı kazancın tamamına yakınını yedi.
#
# Sürüm package-lock.json'dan okunuyor: uygulamanın kullandığı Prisma ile
# migration'ı uygulayan CLI aynı sürüm olmalı, yoksa şema sürüm uyuşmazlığı
# riski doğar. (CLI'nin kendi transitive bağımlılıkları lockfile'a bağlı değil;
# yalnızca `migrate deploy` için kullanıldığından bu kabul edilebilir.)
FROM base AS migrator
WORKDIR /migrator
COPY package-lock.json ./
RUN PRISMA_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")"     && rm package-lock.json     && npm init -y > /dev/null     && npm install --omit=optional --no-audit --no-fund "prisma@${PRISMA_VERSION}"

# --- Derleme -----------------------------------------------------------------
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
#
# ⚠️ NEXT_PUBLIC_APP_URL YER TUTUCU OLAMAZ — imaja GÖMÜLÜR.
#
# #392'den beri `app-url.ts` bu değişken üretimde yoksa bilerek FIRLATIYOR:
# sertifika QR'ı basılıp paylaşıldıktan sonra geri alınamaz, yanlış alan adı
# taşıyan belgeler dolaşımda kalır. Ama Dockerfile onu hiç geçirmiyordu, yani
# İMAJ #400'DEN BERİ HİÇ BUILD OLMUYORDU. CI bunu yakalamadı: CI `npm run
# build` koşuyor ve değişkeni env olarak veriyor, `docker build` ise hiç
# çalıştırılmıyordu (bu PR ile CI'ya eklendi).
#
# Değer `NEXT_PUBLIC_` olduğu için client bundle'a inline ediliyor: çalışma
# anında değiştirilemez, dolayısıyla İMAJ ORTAMA ÖZELDİR. Yer tutucu koymak
# #392'nin düzelttiği hatayı geri getirirdi — bu yüzden varsayılan YOK.
ARG NEXT_PUBLIC_APP_URL
RUN if [ -z "$NEXT_PUBLIC_APP_URL" ]; then \
      echo "" >&2; \
      echo "HATA: --build-arg NEXT_PUBLIC_APP_URL=https://<alan-adi> zorunlu." >&2; \
      echo "" >&2; \
      echo "Bu değer client bundle-a GÖMÜLÜR; sertifika doğrulama, e-posta" >&2; \
      echo "doğrulama ve şifre sıfırlama bağlantıları buna dayanır. Yer tutucu" >&2; \
      echo "kabul edilmiyor: yanlış alan adı taşıyan sertifikalar geri alınamaz." >&2; \
      echo "" >&2; \
      echo "  docker build --build-arg NEXT_PUBLIC_APP_URL=https://ornek.com ." >&2; \
      echo "" >&2; \
      exit 1; \
    fi; \
    DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    AUTH_SECRET="build-time-placeholder-not-used-at-runtime" \
    NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
    npm run build -- --no-lint

# --- Çalıştırma --------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Sürüm damgası — /api/health bunu döner ve "yeni sürüm gerçekten yayına çıktı
# mı?" sorusunu yanıtlar (DEPLOYMENT.md §8.5).
#
# Neden gerekli: standalone imajda npm YOKTUR, dolayısıyla `npm_package_version`
# tanımsız kalır ve health "bilinmiyor" derdi. Build sırasında commit SHA'sı
# geçilebilir; geçilmezse çalışma anındaki GIT_COMMIT_SHA benzeri platform
# değişkenleri yine devrede (route'daki sıraya bakın).
ARG APP_VERSION=bilinmiyor
ENV APP_VERSION=${APP_VERSION}

# standalone çıktısı: Next yalnızca gerçekten kullanılan dosyaların izini sürüp
# kendi kendine yeten bir sunucu (server.js) üretir. Runner'da `npm install`
# YOK — öncesi burada bağımlılıklar ikinci kez kuruluyordu.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Migration'lar için şema + Prisma CLI'nin izole ağacı.
#
# AYRI DİZİNDE (.migrator) tutuluyor: standalone kendi `node_modules`'ünü
# üretiyor, üstüne yazmak onu gölgeleyebilirdi. Entrypoint CLI'yi bu yoldan
# çağırıyor. `npx` kullanılmıyor — npx paketi bulamazsa ağdan indirmeye çalışır,
# bu da her açılışı yavaş ve ağa bağımlı yapardı.
COPY --from=builder /app/prisma ./prisma
COPY --from=migrator /migrator/node_modules ./.migrator/node_modules

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
