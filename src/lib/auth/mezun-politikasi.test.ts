// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * #208 "mezun yazamaz" kuralının BEKÇİSİ.
 *
 * ⚠️ BU TEST BİR HATADAN DOĞDU. Kural yazma uçlarına elle kopyalanıyordu ve
 * denetimde İKİ UÇTA HİÇ YOKTU: `steps/[stepId]/assignee` (mezun eski
 * takımının havuzundan iş çekebiliyordu) ve `student/proposals` POST
 * (onaylanınca atamaya dönüşen bir uç). Hiçbir test bunu yakalamadı çünkü
 * testler VAR OLAN kontrolleri doğruluyordu; OLMAYAN bir kontrolü kimse
 * sormuyordu.
 *
 * Bu test tersini yapıyor: stajyerin erişebildiği HER yazma ucunu tarar ve
 * her birinin ya kapıyı kullandığını ya da gerekçesi YAZILI bir listede
 * olduğunu şart koşar. Yeni bir uç eklendiğinde unutmak **kırmızı test**
 * verir, sessiz bir açık değil.
 *
 * ⚠️ Kapı çalışma anında `requireAuth`'a gömülemedi: mezun panosunu, yol
 * haritasını ve sertifikasını GÖREBİLMELİ (#208), yani okuma/yazma ayrımı
 * gerekiyor ve `requireAuth` bunu bilmiyor. Opt-in bir bayrak da elle
 * yazılan kontrolle aynı hatayı yapardı — bu yüzden koruma testte.
 */

const API = path.join(process.cwd(), "src", "app", "api");

/**
 * Mezuna BİLEREK açık uçlar — her biri gerekçesiyle.
 *
 * ⚠️ Bu listeye bir şey eklemek bir ÜRÜN KARARIDIR, kolaylık değil.
 * #208'in ayrım ilkesi: *sistem durumunu değiştiren* ve *ücretli AI* uçları
 * kapalı; *insan iletişimi* ve *okuma* açık.
 */
const MEZUNA_ACIK: Record<string, string> = {
  "messages/route.ts":
    "İnsan iletişimi (#208). Mezunun mentörüne/admin'e yazabilmesi meşru: " +
    "referans, kariyer tavsiyesi. Düşük riskli.",
  "messages/typing/route.ts":
    "Mesajlaşmanın eşi (#354). Kozmetik sinyal; mesaj yazabilen yazıyor da " +
    "görünebilmeli.",
  "suggestions/route.ts":
    "İnsan iletişimi (#208). Öneri/istek kanalı mezuna bilerek açık.",
  "ofis-saati/[slotId]/route.ts":
    "Görüşme rezervasyonu (#398). Mesajlaşmanın eşi; kıtlık mentörün " +
    "kontrolünde — slotu o açıyor, iptal edebiliyor.",
  "profile/ai-riza/route.ts":
    "⚠️ KVKK: rızanın GERİ ALINABİLİR olması zorunlu (m.11). Bu ucu mezuna " +
    "kapatmak, kullanıcıyı kendi verisi üzerindeki hakkından ederdi.",
  "bildirimler/route.ts":
    "Kendi bildirimini okundu işaretlemek. Okuma tarafının parçası; " +
    "sistem durumunu değiştirmiyor.",
  "profile/avatar/route.ts":
    "Kendi profil fotoğrafı. Portfolyo içeriği değil, hesabın kendisi.",
  "student/survey-answers/route.ts":
    "Profil tamamlama akışı (#143), `allowUnapprovedStudent` ile PENDING " +
    "için açık. Mezun bu akışa zaten girmiyor; ayrı bir kapı gürültü olurdu.",
  "auth/resend-verification/route.ts":
    "Kendi e-posta doğrulama bağlantısını yeniden isteme. Hesabın kendisine " +
    "ait, portfolyo içeriği değil; doğrulanmamış bir mezunun bu yolu " +
    "kaybetmesi için sebep yok.",
  "student/takilma-bildirimi/route.ts":
    "Bildirim TERCİHİ (#397). Radar mezunu zaten kapsam dışı bırakıyor; " +
    "tercihini değiştirebilmesi zararsız.",
};

const YAZMA_METOTLARI = ["POST", "PUT", "PATCH", "DELETE"];

type Uc = { ad: string; kaynak: string };

function rotalariTopla(dizin: string, uclar: Uc[] = []): Uc[] {
  for (const girdi of fs.readdirSync(dizin, { withFileTypes: true })) {
    const tam = path.join(dizin, girdi.name);
    if (girdi.isDirectory()) rotalariTopla(tam, uclar);
    else if (girdi.name === "route.ts") {
      uclar.push({
        ad: path.relative(API, tam).split(path.sep).join("/"),
        kaynak: fs.readFileSync(tam, "utf8"),
      });
    }
  }
  return uclar;
}

/**
 * Kaynağı `export async function X` sınırlarından bölerek metot bloklarını verir.
 *
 * ⚠️ DOSYA BAZINDA BAKMAK YETMİYOR. İlk sürüm dosyadaki İLK `requireAuth`
 * çağrısına bakıyordu ve `ofis-saati/route.ts`'i yanlış işaretledi: GET'i
 * `["MENTOR","STUDENT"]`, POST'u ise yalnız `"MENTOR"`. Yazma ucunun rolünü
 * okumak için blok blok bakmak gerekiyor.
 */
function metotBloklari(kaynak: string): Map<string, string> {
  const bloklar = new Map<string, string>();
  const kalip = /export async function ([A-Z]+)/g;
  const konumlar: { ad: string; indeks: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = kalip.exec(kaynak)) !== null) {
    konumlar.push({ ad: m[1], indeks: m.index });
  }
  konumlar.forEach((k, i) => {
    const bitis = i + 1 < konumlar.length ? konumlar[i + 1].indeks : kaynak.length;
    bloklar.set(k.ad, kaynak.slice(k.indeks, bitis));
  });
  return bloklar;
}

/**
 * Stajyer bu BLOĞA erişebiliyor mu?
 *
 * `requireAuth("ADMIN")` / `requireAuth("MENTOR")` altındaki uçlara mezun bir
 * STUDENT hiç ulaşamaz; onlara kapı aramak gürültü olurdu. Rol verilmeyen
 * (`requireAuth()` ya da `requireAuth(undefined, ...)`) uçlar HERKESE açıktır,
 * yani stajyer de girer.
 */
function stajyerErisebilirMi(blok: string): boolean {
  const cagri = blok.match(/requireAuth\(([^)]*)\)/);
  if (!cagri) return false; // oturumsuz uç (webhook, auth callback) — kapsam dışı
  const arg = cagri[1].trim();
  if (arg === "" || arg.startsWith("undefined")) return true; // rol kısıtı yok
  return arg.includes("STUDENT");
}

/**
 * Kapısı olmayan, stajyerin erişebildiği yazma metotlarını döner.
 *
 * ⚠️ DOSYADA METİN ARAMAK YETMİYOR — bu test ilk hâlinde tam olarak bunu
 * yapıyordu ve MUTASYON TESTİNDE ÇÖKTÜ: `assignee` ucundan kapıyı sildim,
 * beş test de geçmeye devam etti. Sebep, `import { mezunYazmaKapisi }`
 * satırının dosyada kalması; "dosya bu adı içeriyor" koşulu kapı silinse de
 * doğruydu. Kontrol artık ÇAĞRININ metot bloğunun içinde olmasını arıyor.
 */
function kapisizYazmaMetotlari(kaynak: string): string[] {
  const bloklar = metotBloklari(kaynak);
  return YAZMA_METOTLARI.filter((m) => {
    const blok = bloklar.get(m);
    if (blok === undefined) return false;
    if (!stajyerErisebilirMi(blok)) return false;
    return !blok.includes("mezunYazmaKapisi(");
  });
}

/** Stajyerin erişebildiği en az bir YAZMA metodu var mı? */
function stajyerYazabilirMi(kaynak: string): boolean {
  const bloklar = metotBloklari(kaynak);
  return YAZMA_METOTLARI.some((m) => {
    const blok = bloklar.get(m);
    return blok !== undefined && stajyerErisebilirMi(blok);
  });
}

const uclar = rotalariTopla(API);
const stajyerYazmaUclari = uclar.filter((u) => stajyerYazabilirMi(u.kaynak));

describe("mezun yazma politikası (#208)", () => {
  it("tarama gerçekten uç buluyor — boş liste testi anlamsız kılardı", () => {
    expect(stajyerYazmaUclari.length).toBeGreaterThan(10);
  });

  it("⚠️ stajyerin eriştiği HER yazma ucu ya kapılı ya gerekçeli", () => {
    const kapisiz = stajyerYazmaUclari
      .filter((u) => !(u.ad in MEZUNA_ACIK))
      .flatMap((u) => kapisizYazmaMetotlari(u.kaynak).map((m) => `${u.ad} [${m}]`));

    expect(
      kapisiz,
      "Bu uçlar mezun stajyere AÇIK ve sebebi yazılı değil.\n" +
        "Ya `mezunYazmaKapisi(auth.session, \"...\")` ekleyin, ya da\n" +
        "MEZUNA_ACIK listesine GEREKÇESİYLE yazın (#208 ayrım ilkesi:\n" +
        "sistem durumunu değiştiren + ücretli AI kapalı, insan iletişimi açık).",
    ).toEqual([]);
  });

  it("⚠️ elle yazılmış GRADUATED kontrolü KALMADI — tek şekil olmalı", () => {
    // Altı yerde `role === "STUDENT" && ...`, üç yerde rolsüz yazılmıştı.
    // İki şeklin yan yana durması sapmanın kaynağıydı.
    const elleYazan = uclar
      .filter((u) => u.kaynak.includes('accountStatus === "GRADUATED"'))
      .map((u) => u.ad);

    expect(elleYazan).toEqual([
      // Tek istisna: burada kapı DEĞİL, okuma İZNİ hesaplanıyor —
      // mezun ya da sertifikası düzenlenmiş öğrenci belgesini görebilir.
      "student/certificate/route.ts",
    ]);
  });

  it("MEZUNA_ACIK listesindeki her uç GERÇEKTEN var", () => {
    // Silinen bir uç listede kalırsa gerekçe çürür ve liste güven kaybeder.
    const mevcut = new Set(uclar.map((u) => u.ad));
    const hayalet = Object.keys(MEZUNA_ACIK).filter((a) => !mevcut.has(a));

    expect(hayalet).toEqual([]);
  });

  it("her gerekçe anlamlı uzunlukta — 'ok' geçiştirmesi kabul edilmez", () => {
    for (const [ad, gerekce] of Object.entries(MEZUNA_ACIK)) {
      expect(gerekce.length, ad).toBeGreaterThan(40);
    }
  });
});
