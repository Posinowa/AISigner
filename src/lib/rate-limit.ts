import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Rate limiter — sayaçlar VERİTABANINDA (#322).
 *
 * NEDEN DEĞİŞTİ: Sayaçlar süreç belleğindeki `Map`'lerde tutuluyordu ve
 * süreç-yereldi. Birden fazla instance çalıştığında paylaşılmadıkları için
 * brute-force koruması SESSİZCE zayıflıyordu — 5 denemelik login limiti 3
 * pod'da fiilen 15 oluyor ve bu hiçbir yerde görünmüyordu.
 *
 * NEDEN REDIS DEĞİL: Veritabanı zaten var. Redis yeni bir altyapı bileşeni,
 * yeni bir maliyet ve yeni bir "Redis düşerse ne olacak" sorusu demekti.
 * Login denemesi başına bir DB yazımı bu ölçekte önemsiz.
 *
 * ⚠️ ARAYÜZ ARTIK ASENKRON. `check`/`peek`/`reset` Promise döner; çağıran
 * taraflar `await` etmeli.
 */

interface RateLimiterOptions {
  /** Pencere içinde izin verilen azami istek sayısı */
  maxRequests: number;
  /** Pencere uzunluğu (saniye) */
  windowSeconds: number;
}

export type RateLimitSonuc = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** Süresi dolmuş satırların temizliği: her N çağrıda bir, fırsatçı. */
const TEMIZLIK_PERIYODU = 200;
let cagriSayaci = 0;

/**
 * Süresi geçmiş kayıtları siler.
 *
 * Bellek sürümünde bunu bir `setInterval` yapıyordu. Veritabanında zamanlayıcı
 * tutmak yerine fırsatçı temizlik tercih edildi: her instance'ın kendi
 * zamanlayıcısını çalıştırması gereksiz yük olurdu.
 *
 * Hata YUTULUR: temizlik başarısız olursa rate-limit çalışmaya devam etmeli.
 */
async function firsatciTemizlik(): Promise<void> {
  cagriSayaci = (cagriSayaci + 1) % TEMIZLIK_PERIYODU;
  if (cagriSayaci !== 0) return;

  try {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  } catch (error) {
    logger.warn("Rate-limit temizliği başarısız", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createRateLimiter(name: string, options: RateLimiterOptions) {
  const anahtar = (identifier: string) => `${name}:${identifier}`;

  return {
    /**
     * Bir isteği SAYAR ve sınır içinde mi söyler.
     *
     * ATOMİK: okuma ve yazma tek bir SQL ifadesinde. Ayrı `findUnique` +
     * `update` yapmak, çok instance'ta tam da gidermeye çalıştığımız yarış
     * durumunu geri getirirdi — iki istek aynı sayacı okuyup ikisi de geçerdi.
     *
     * Sayaç sınırı AŞMAZ: limit dolduğunda artırmıyoruz (bellek sürümünün
     * davranışı korunuyor), böylece `retryAfter` sürekli ileri itilmez.
     */
    async check(identifier: string): Promise<RateLimitSonuc> {
      const k = anahtar(identifier);
      const yeniReset = new Date(Date.now() + options.windowSeconds * 1000);

      try {
        const satirlar = await prisma.$queryRaw<
          { count: number; resetAt: Date }[]
        >`
          INSERT INTO "RateLimit" ("key", "count", "resetAt")
          VALUES (${k}, 1, ${yeniReset})
          ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE
              WHEN "RateLimit"."resetAt" <= now() THEN 1
              WHEN "RateLimit"."count" <= ${options.maxRequests} THEN "RateLimit"."count" + 1
              ELSE "RateLimit"."count"
            END,
            "resetAt" = CASE
              WHEN "RateLimit"."resetAt" <= now() THEN ${yeniReset}
              ELSE "RateLimit"."resetAt"
            END
          RETURNING "count", "resetAt"
        `;

        void firsatciTemizlik();

        const satir = satirlar[0];
        if (!satir) return izinVer(options.maxRequests);

        return sonucUret(satir.count, satir.resetAt, options.maxRequests);
      } catch (error) {
        // AÇIK FAIL-OPEN KARARI: veritabanına ulaşılamıyorsa isteği REDDETMEK,
        // DB kesintisinde tüm girişleri kilitlemek demekti. Rate-limit bir
        // savunma-derinliği katmanı; kimlik doğrulamanın kendisi değil.
        // Sessiz kalmıyoruz — bu durum loglanıyor.
        logger.error("Rate-limit sorgusu başarısız — istek geçirildi", {
          limiter: name,
          error: error instanceof Error ? error.message : String(error),
        });
        return izinVer(options.maxRequests);
      }
    },

    /**
     * Sayacı ARTIRMADAN durumu bildirir.
     *
     * Kullanımı: zaten bloklanmış bir kimliği pahalı işe girmeden reddetmek;
     * `check` yalnızca gerçek denemeyi (ör. başarısız giriş) kaydetmek için
     * çağrılır. Böylece başarılı girişler sayaca yazılmaz.
     */
    async peek(identifier: string): Promise<RateLimitSonuc> {
      try {
        const satir = await prisma.rateLimit.findUnique({
          where: { key: anahtar(identifier) },
          select: { count: true, resetAt: true },
        });

        if (!satir || satir.resetAt <= new Date()) return izinVer(options.maxRequests);

        // peek sayacı artırmıyor; "bir sonraki istek geçer mi" sorusunu
        // yanıtlaması için +1 ile değerlendiriyoruz.
        return sonucUret(satir.count + 1, satir.resetAt, options.maxRequests);
      } catch (error) {
        logger.error("Rate-limit peek başarısız — istek geçirildi", {
          limiter: name,
          error: error instanceof Error ? error.message : String(error),
        });
        return izinVer(options.maxRequests);
      }
    },

    /** Sayacı sıfırlar (ör. başarılı giriş sonrası). */
    async reset(identifier: string): Promise<void> {
      try {
        await prisma.rateLimit.deleteMany({ where: { key: anahtar(identifier) } });
      } catch (error) {
        logger.warn("Rate-limit sıfırlama başarısız", {
          limiter: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

function izinVer(maxRequests: number): RateLimitSonuc {
  return { allowed: true, remaining: maxRequests, retryAfterSeconds: 0 };
}

function sonucUret(count: number, resetAt: Date, maxRequests: number): RateLimitSonuc {
  const kalan = Math.max(0, maxRequests - count);

  // `count` ARTIRILDIKTAN SONRAKİ değer. Bu yüzden karşılaştırma `<=`:
  // maxRequests=10 iken 10. istek geçmeli, 11. bloke olmalı. (`<` kullanmak
  // 9 istekte bloke ederdi — bellek sürümünün davranışına göre bir eksik.)
  if (count <= maxRequests) {
    return { allowed: true, remaining: kalan, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
}
