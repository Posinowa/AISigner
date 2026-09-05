import { after } from "next/server";
import { logger } from "@/lib/logger";
import { bildirSunucuHatasi, type HataBaglami } from "@/lib/error-alerts";
import { ISTEK_KIMLIGI_BASLIGI } from "@/lib/istek-kimligi";

/**
 * API rotalarının `catch` bloğu için TEK giriş noktası.
 *
 * ⚠️ NEDEN VAR — ölçüldü: 70 rotanın 46'sı `console.error` kullanıyordu,
 * yalnız 9'u `logger`. Bunun iki bedeli vardı:
 *
 * 1. **Üretimde yapısal log yok.** `logger` üretimde JSON basıyor (#314);
 *    `console.error` düz metin bırakıyor. Log toplayıcı için 46 rotanın
 *    çıktısı ayrıştırılamaz metindi.
 *
 * 2. **⚠️ ASIL SORUN: yakalanan hatalar HİÇ BİLDİRİLMİYORDU.**
 *    `bildirSunucuHatasi` yalnız `instrumentation.ts`'teki
 *    `onRequestError`'dan çağrılıyor ve o hook YALNIZ YAKALANMAYAN hatalar
 *    için çalışıyor. Oysa rotaların baskın deseni
 *    `catch { console.error(...); return 500 }` — yani **en sık hata yolu
 *    operatöre hiç ulaşmıyordu.** #317 bildirim altyapısını kurmuştu ama
 *    kapsamı sanılandan çok dardı.
 *
 * Sel riski yok: `bildirSunucuHatasi` aynı imzalı hatayı 15 dakikada bir
 * bildiriyor ve arada bastırılanları sayıp bir sonraki iletide raporluyor.
 *
 * ⚠️ HİÇBİR DURUMDA FIRLATMAZ. Hata yolundan çağrılıyor; kendisi patlarsa
 * asıl hatayı gölgeler ve rota 500 yerine anlaşılmaz bir çökme üretir.
 */
export function rotaHatasi(
  /**
   * İnsan okunur kapsam — mevcut `console.error` metinleriyle aynı biçim,
   * ör. `"DELETE /api/admin/users/[userId]"`. Bildirim imzasında da
   * kullanılıyor, yani rotalar birbirinin susturmasına takılmıyor.
   */
  kapsam: string,
  hata: unknown,
  baglam: HataBaglami = {},
): void {
  const alanlar = {
    // `Error` JSON.stringify ile boş nesneye dönüşür; alanları elle açıyoruz.
    ad: hata instanceof Error ? hata.name : typeof hata,
    mesaj: hata instanceof Error ? hata.message : String(hata),
    stack: hata instanceof Error ? hata.stack : undefined,
  };

  /*
   * #491: İSTEK KİMLİĞİ log satırına giriyor.
   *
   * ⚠️ `headers()` Next 15'te ASENKRON, bu yüzden satır bir mikro-görev
   * sonra yazılıyor. `after()` KULLANILMADI: o, logu yanıt akıtıldıktan
   * SONRAYA ertelerdi ve süreç hemen çökerse hata satırı tamamen
   * kaybolurdu. Mikro-görev, kimliği kazandırırken bu riski almıyor.
   *
   * ⚠️ KİMLİK OKUNAMAZSA SATIR YİNE YAZILIYOR. İstek bağlamı dışında
   * (arka plan işleri, testler) `headers()` fırlatır; korelasyon
   * kaybolabilir ama HATA LOGU kaybolamaz.
   */
  /*
   * #491: İstek kimliği BİR KEZ okunuyor ve iki tüketici (log + bildirim)
   * aynı sözü paylaşıyor.
   *
   * ⚠️ İlk sürümde her iki yol `headers()`'ı AYRI AYRI okuyordu ve
   * bildirim yolunda kimlik boş çıkıyordu — log satırında dolu olmasına
   * rağmen. İki okuma yerine tek söz hem bu farkı ortadan kaldırıyor hem
   * de istek başına yapılan işi yarıya indiriyor.
   *
   * ⚠️ `headers()` Next 15'te ASENKRON, bu yüzden log satırı bir mikro-görev
   * sonra yazılıyor. `after()` KULLANILMADI: o, logu yanıt akıtıldıktan
   * SONRAYA ertelerdi ve süreç hemen çökerse hata satırı tamamen kaybolurdu.
   */
  const kimlikSozu: Promise<string | undefined> = (async () => {
    try {
      const { headers } = await import("next/headers");
      return (await headers()).get(ISTEK_KIMLIGI_BASLIGI) ?? undefined;
    } catch {
      // İstek bağlamı yok (arka plan işi, test) — korelasyon olmadan devam.
      return undefined;
    }
  })();

  /*
   * ⚠️ KİMLİK OKUNAMAZSA SATIR YİNE YAZILIYOR. Korelasyon kaybolabilir
   * ama HATA LOGU kaybolamaz.
   */
  void (async () => {
    const istekKimligi = await kimlikSozu;
    logger.error(kapsam, istekKimligi ? { ...alanlar, istekKimligi } : alanlar);
  })();

  const bildir = async () => {
    const istekKimligi = await kimlikSozu;
    return bildirSunucuHatasi(hata, {
      routePath: kapsam,
      ...baglam,
      ...(istekKimligi ? { istekKimligi } : {}),
    }).catch(() => {
      // `bildirSunucuHatasi` zaten yutuyor; bu yalnız son kale.
    });
  };

  /*
   * ⚠️ YANIT BEKLETİLMİYOR. Bildirim e-posta gönderiyor; `await` etmek 500
   * yanıtını SMTP'nin hızına bağlardı. `after()` işi yanıt akıtıldıktan
   * sonra koşturuyor.
   *
   * İstek bağlamı dışında (birim testler, arka plan işleri) `after` fırlatır;
   * o durumda serbest promise'e düşüyoruz — orada bekleyen bir yanıt yok.
   */
  try {
    after(bildir);
  } catch {
    void bildir();
  }
}
