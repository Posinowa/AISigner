/**
 * İstemci IP'sini GÜVENİLİR biçimde çözer (rate-limit anahtarı olarak kullanılır).
 *
 * ⚠️ NEDEN AYRI BİR MODÜL — eski davranış rate-limit'i işe yaramaz hale getiriyordu:
 * kod `x-forwarded-for`'un EN SOLDAKİ değerini alıyordu. Oysa ters vekil (reverse
 * proxy) bu başlığa **ekleme** yapar, silme yapmaz:
 *
 *     istemcinin gönderdiği:  X-Forwarded-For: 1.2.3.4
 *     vekilden sonra:         X-Forwarded-For: 1.2.3.4, <gerçek istemci IP>
 *
 * Yani en soldaki değer İSTEMCİNİN UYDURDUĞU değerdir. Saldırgan her istekte
 * farklı bir değer göndererek signup / login / şifre-sıfırlama limitlerinin
 * tamamını atlayabilirdi.
 *
 * DOĞRUSU: sağdan saymak. En sağdaki girdiyi bize en yakın (güvendiğimiz) vekil
 * yazar ve o vekilin gerçekten gördüğü soket adresidir — istemci oraya yazamaz.
 * Önümüzde N adet güvenilen vekil varsa sağdan N. girdi gerçek istemcidir.
 *
 *     TRUSTED_PROXY_HOPS=1 (varsayılan, tek vekil):  "spoof, spoof, GERÇEK"
 *     TRUSTED_PROXY_HOPS=2 (CDN + LB):               "spoof, GERÇEK, vekil1"
 *
 * `x-real-ip` yalnızca YEDEK olarak kullanılır: vekiller onu genelde üzerine
 * yazar ama garanti değildir, bu yüzden XFF varken ona bakmıyoruz.
 */

/** Başlıkları hem `Headers` hem düz nesne olarak kabul eden okuma yardımcısı. */
type BaslikKaynagi =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined;

function baslikOku(kaynak: BaslikKaynagi, ad: string): string | undefined {
  if (!kaynak) return undefined;

  if (typeof (kaynak as Headers).get === "function") {
    return (kaynak as Headers).get(ad) ?? undefined;
  }

  const deger = (kaynak as Record<string, string | string[] | undefined>)[ad];
  return Array.isArray(deger) ? deger[0] : deger;
}

/**
 * Önümüzdeki güvenilen vekil sayısı. Platform değiştikçe kodu değil env'i
 * güncelleriz. Geçersiz/eksik değerde 1'e düşer (tek vekil — en yaygın kurulum).
 */
function guvenilenVekilSayisi(): number {
  const ham = Number(process.env.TRUSTED_PROXY_HOPS);
  if (!Number.isInteger(ham) || ham < 1) return 1;
  return ham;
}

/** Rate-limit anahtarı olarak kullanılamayacak değerler için tek sabit. */
export const BILINMEYEN_IP = "anonymous";

export function getClientIp(headers: BaslikKaynagi): string {
  const fwd = baslikOku(headers, "x-forwarded-for");

  if (fwd) {
    const girdiler = fwd
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (girdiler.length > 0) {
      // Sağdan say. Zincir beklenenden kısaysa (ör. vekil sayısı yanlış
      // yapılandırılmış) en soldakine düşeriz — güvenli taraf: gerçek istemciyi
      // kaçırmaktansa uydurma değeri anahtar yapmak, hiç limitlememekten iyidir.
      const indeks = Math.max(0, girdiler.length - guvenilenVekilSayisi());
      return girdiler[indeks]!;
    }
  }

  const realIp = baslikOku(headers, "x-real-ip")?.trim();
  if (realIp) return realIp;

  return BILINMEYEN_IP;
}
