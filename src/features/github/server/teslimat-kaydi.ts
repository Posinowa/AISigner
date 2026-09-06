import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Webhook teslimat kaydı ve temizliği (#378).
 *
 * `ProcessedWebhook` tekrar işlemeyi önlüyor (#326). Şemada
 * `@@index([createdAt])` ve "eski kayıtların temizliği için" notu vardı ama
 * kod tabanında `deleteMany` HİÇ çağrılmıyordu: tablo yalnızca büyüyordu.
 */

/**
 * Kayıtların saklanma süresi.
 *
 * GitHub başarısız teslimatları tekrar deniyor ve elle yeniden gönderim
 * (redeliver) mümkün; pencere bu aralıktan belirgin biçimde UZUN olmalı,
 * yoksa temizlik idempotens korumasını delerdi. 7 gün, tekrar denemelerin
 * (saatler) çok üstünde ve tablo boyutunu sınırlı tutuyor.
 */
export const SAKLAMA_GUN = 7;

/** Fırsatçı temizlik olasılığı — `rate-limit.ts` / `TypingSignal` deseni. */
const TEMIZLIK_OLASILIGI = 0.02;

/**
 * Süresi geçmiş teslimat kayıtlarını ara sıra siler.
 *
 * Her webhook'ta silmek, her isteğe fazladan bir DELETE eklerdi. Zamanlanmış
 * iş kurmak da bu boyut için fazla: tablo yalnızca teslimat hızıyla büyüyor
 * ve okuma zaten birincil anahtar üzerinden.
 *
 * ⚠️ HATA YUTULUR. Temizlik başarısız olsa da webhook işlenmeye devam
 * etmeli; bakım işi teslimatı düşürmemeli.
 */
export async function teslimatKayitlariniTemizle(): Promise<void> {
  if (Math.random() > TEMIZLIK_OLASILIGI) return;

  const sinir = new Date(Date.now() - SAKLAMA_GUN * 86_400_000);
  try {
    const { count } = await prisma.processedWebhook.deleteMany({
      where: { createdAt: { lt: sinir } },
    });
    if (count > 0) logger.info("Eski webhook teslimat kayıtları silindi", { count });
  } catch (error) {
    logger.warn("Webhook teslimat temizliği başarısız", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
