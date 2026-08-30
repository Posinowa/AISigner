#!/bin/sh
# #193: Konteyner başlangıç script'i (Out Plane vb. platformlar için).
set -e

# --- GCP kimlik bilgisi: env değişkeninden dosyaya ---
# Out Plane'de "dosya secret'ı" yoktur. Vertex AI (Gemini) SDK'sı ise kimlik
# bilgisini bir DOSYA yolundan (GOOGLE_APPLICATION_CREDENTIALS) okur. Bu yüzden
# JSON içeriğini GCP_CREDENTIALS_JSON env değişkeninde saklayıp açılışta dosyaya
# yazıyoruz. GÜVENLİK: umask 077 → dosya yalnızca sahibine okunur/yazılır (600);
# içerik ASLA loglanmaz.
if [ -n "$GCP_CREDENTIALS_JSON" ]; then
  umask 077
  printf '%s' "$GCP_CREDENTIALS_JSON" > /app/gcp-credentials.json
  export GOOGLE_APPLICATION_CREDENTIALS="/app/gcp-credentials.json"
  echo "→ GCP kimlik dosyası env değişkeninden yazıldı (içerik gizli)."
else
  echo "→ GCP_CREDENTIALS_JSON tanımlı değil; AI özellikleri mock'a düşecek."
fi

# --- Şema göçleri ---
# Prod'da güvenli: yalnızca uygulanmamış migration'ları uygular (db push/seed DEĞİL).
# `npx` DEĞİL doğrudan yerel binary: npx, paket bulunmazsa sessizce ağdan
# indirmeye çalışır. Prisma CLI imaja bilerek kopyalandığı (Dockerfile) için
# doğrudan çağırmak hem hızlı hem de ağı kapalı ortamda deterministik.
echo "→ Prisma migrate deploy çalışıyor..."
node ./.migrator/node_modules/prisma/build/index.js migrate deploy --schema=./prisma/schema.prisma

# --- Sunucu ---
# standalone çıktısının kendi sunucusu (server.js). Öncesi `npm run start:docker`
# idi; standalone imajda npm script'leri ve `next` binary'si bulunmaz.
# PORT/HOSTNAME env'lerini server.js kendisi okur.
# exec: sinyaller (SIGTERM) doğrudan Node sürecine iletilsin (temiz kapanış) —
# araya npm girmemesi, platformun kapatma sinyalinin kaybolmamasını da sağlar.
echo "→ Uygulama başlatılıyor..."
exec node server.js
