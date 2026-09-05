import "server-only";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";

/**
 * Üretimdeki sunucu hatalarını operatöre e-posta ile bildirir.
 *
 * NEDEN VAR: yapısal log (JSON) hataları *aranabilir* yapıyor ama birinin
 * bakmasını gerektiriyor. Log tabanlı uyarı kurulmayacağına göre, 500'lerden
 * haberdar olmanın tek yolu aktif bildirim.
 *
 * ⚠️ E-POSTA PATLAMAYA DUYARLI. Bir uç sürekli hata veriyorsa dakikada yüzlerce
 * mail SMTP hesabının kısıtlanmasına ya da engellenmesine yol açar. Bu yüzden
 * susturma isteğe bağlı DEĞİL: aynı imzalı hata en fazla `SUSTURMA_MS`'de bir
 * bildirilir, arada bastırılanlar sayılıp bir sonraki iletide raporlanır.
 *
 * ⚠️ SESSİZ BAŞARISIZLIK: `sendMail` sözleşme gereği hata fırlatmaz. SMTP
 * yapılandırılmamışsa bildirim de gitmez — ve bozulan şey SMTP'nin kendisiyse
 * bunu haber verecek mekanizma da odur. Bu yüzden gönderim sonucu ayrıca
 * loglanıyor: en azından log tarafında iz kalsın.
 */

const SUSTURMA_MS = 15 * 60 * 1000;

/**
 * Harita sınırsız büyümesin: benzersiz imza sayısı patlarsa (ör. mesajında
 * değişken taşıyan hatalar) bellek sızıntısına dönerdi.
 */
const MAKS_IMZA = 200;

type Ozet = { bastirilan: number; sonGonderim: number };

const ozetler = new Map<string, Ozet>();

/** Yalnızca testler için. */
export function resetAlertStateForTests(): void {
  ozetler.clear();
}

export type HataBaglami = {
  /** İstek yolu (sorgu dizesi olmadan — PII sorgu parametrelerinde olabilir). */
  path?: string;
  method?: string;
  /** Next'in route tanımı, ör. /api/admin/users/[userId]. */
  routePath?: string;
  /**
   * #491: İstek kimliği (correlation ID).
   *
   * Bildirimi alan kişi, aynı kimlikle loglarda o isteğin TÜM satırlarını
   * bulabilsin diye taşınıyor. İmzaya GİRMİYOR (`imzaUret`): her istek
   * benzersiz olduğu için imzaya katılsaydı susturma tamamen işlevsiz
   * kalır ve aynı hata her seferinde yeniden bildirilirdi.
   */
  istekKimligi?: string;
};

/**
 * Bildirim imzası: AYNI hatanın tekrarları tek bir gruba düşsün.
 * Mesajın tamamı değil ilk satırı kullanılıyor — stack detayı imzayı
 * gereksizce çeşitlendirirdi.
 */
function imzaUret(hata: unknown, baglam: HataBaglami): string {
  const ad = hata instanceof Error ? hata.name : "UnknownError";
  const mesaj =
    hata instanceof Error ? (hata.message.split("\n")[0] ?? "") : String(hata);
  return `${ad}|${mesaj}|${baglam.routePath ?? baglam.path ?? "-"}`;
}

/** Bildirimlerin gideceği adres. Tanımlı değilse özellik kapalıdır. */
function alici(): string | undefined {
  return process.env.ERROR_ALERT_EMAIL?.trim() || undefined;
}

function govdeUret(
  hata: unknown,
  baglam: HataBaglami,
  bastirilan: number,
): string {
  const satirlar = [
    "AISigner — sunucu hatası",
    "",
    `Zaman   : ${new Date().toISOString()}`,
    `Sürüm   : ${process.env.APP_VERSION ?? process.env.GIT_COMMIT_SHA ?? "bilinmiyor"}`,
    `Yol     : ${baglam.method ?? "-"} ${baglam.path ?? "-"}`,
    `Route   : ${baglam.routePath ?? "-"}`,
    // #491: Bildirimi alan kişi bu kimlikle loglarda aynı isteğin tüm
    // satırlarını bulabiliyor — e-postada olmasa taşınmasının anlamı kalmazdı.
    `İstek   : ${baglam.istekKimligi ?? "-"}`,
    "",
    `Hata    : ${hata instanceof Error ? `${hata.name}: ${hata.message}` : String(hata)}`,
  ];

  if (hata instanceof Error && hata.stack) {
    // Yığın izini sınırla: e-postayı okunmaz hale getirmesin.
    satirlar.push("", "Yığın izi (ilk 15 satır):", hata.stack.split("\n").slice(0, 15).join("\n"));
  }

  if (bastirilan > 0) {
    satirlar.push(
      "",
      `NOT: Son bildirimden bu yana AYNI hata ${bastirilan} kez daha oluştu ` +
        `(e-posta seli olmasın diye bastırıldı).`,
    );
  }

  return satirlar.join("\n");
}

/**
 * Hata bildirimini (susturmaya uyarak) gönderir.
 *
 * HİÇBİR DURUMDA HATA FIRLATMAZ: bu fonksiyon hata yolundan çağrılıyor,
 * kendisi patlarsa asıl hatayı gölgeler.
 */
export async function bildirSunucuHatasi(
  hata: unknown,
  baglam: HataBaglami = {},
): Promise<void> {
  try {
    const to = alici();
    if (!to) return; // Özellik kapalı — sessizce geç.

    const imza = imzaUret(hata, baglam);
    const simdi = Date.now();
    const ozet = ozetler.get(imza);

    if (ozet && simdi - ozet.sonGonderim < SUSTURMA_MS) {
      ozet.bastirilan += 1;
      return;
    }

    // Yer açmak gerekiyorsa en eski girdiyi düşür (Map ekleme sırasını korur).
    if (!ozet && ozetler.size >= MAKS_IMZA) {
      const enEski = ozetler.keys().next().value;
      if (enEski !== undefined) ozetler.delete(enEski);
    }

    const bastirilan = ozet?.bastirilan ?? 0;
    ozetler.set(imza, { bastirilan: 0, sonGonderim: simdi });

    const sonuc = await sendMail({
      to,
      subject: `[AISigner] Sunucu hatası — ${baglam.routePath ?? baglam.path ?? "bilinmeyen yol"}`,
      text: govdeUret(hata, baglam, bastirilan),
    });

    if (!sonuc.sent) {
      // Bildirim gidemedi. En azından logda iz bırak — sessizce kaybolmasın.
      logger.error("Hata bildirimi gönderilemedi", { reason: sonuc.reason, imza });
    }
  } catch (bildirimHatasi) {
    logger.error("Hata bildirimi sırasında beklenmeyen hata", {
      error:
        bildirimHatasi instanceof Error
          ? bildirimHatasi.message
          : String(bildirimHatasi),
    });
  }
}
