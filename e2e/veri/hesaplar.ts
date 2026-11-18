/**
 * E2E hesapları (#510) — TEK KAYNAK.
 *
 * ⚠️ NEDEN SEED'E EKLENMEDİ: `scripts/seed.ts` demo verisi üretiyor ve
 * geliştirici makinelerinde de koşuyor. Oraya PENDING/REJECTED/GRADUATED
 * hesap eklemek, herkesin panosuna testin ihtiyacı olan yapay durumları
 * sokardı. E2E'nin kendi veri kurulumu var ve kurduğu şey adından belli.
 *
 * ⚠️ E-POSTA ÖNEKİ BİLEREK AYIRT EDİCİ (`e2e-…@e2e.local`): kurulum
 * geliştirme veritabanında da koşabiliyor; hangi satırların testin
 * olduğunun bakışta anlaşılması gerekiyor. Kurulum yalnız BU hesapları
 * upsert eder, var olan hiçbir satıra dokunmaz.
 */

export const E2E_PAROLA = process.env.DEMO_PASSWORD ?? "geçici_şifre";

export type E2EHesap = {
  email: string;
  ad: string;
  accountStatus: "PENDING" | "REJECTED" | "GRADUATED";
  /** Profili olan hesap: sertifika/pano uçları profile bağlı. */
  profil: boolean;
};

export const E2E_HESAPLARI: E2EHesap[] = [
  { email: "e2e-pending@e2e.local", ad: "E2E Pending", accountStatus: "PENDING", profil: false },
  { email: "e2e-rejected@e2e.local", ad: "E2E Rejected", accountStatus: "REJECTED", profil: false },
  { email: "e2e-mezun@e2e.local", ad: "E2E Mezun", accountStatus: "GRADUATED", profil: true },
];

export const HESAP = {
  pending: E2E_HESAPLARI[0],
  rejected: E2E_HESAPLARI[1],
  mezun: E2E_HESAPLARI[2],
};

/**
 * İŞ AKIŞI HESAPLARI (`akislar.spec.ts`) — APPROVED, durumu DEĞİŞTİREN testler.
 *
 * ⚠️ SEED HESAPLARINDAN AYRI: testler revizyon ister, adım tamamlar, mezun
 * eder. Bunu demo hesapları üzerinde yapmak, geliştiricinin panosunu her
 * koşuda bozardı. Kurulum bu hesapların verisini HER KOŞUDA başlangıç
 * durumuna geri yazar (`kur.ts` → `akisVerisiniKur`).
 *
 * ⚠️ `akisB` BİLEREK yalnız TAKIM üzerinden mentöre bağlı (MentorAssignment
 * yok): takım körlüğünün (#332) en saf hali. Mentör panosunda görünmüyorsa
 * sorgu tek yola bakıyor demektir.
 */
export const AKIS = {
  mentor: { email: "e2e-mentor@e2e.local", ad: "E2E Mentör", role: "MENTOR" as const },
  ogrenciA: { email: "e2e-akis-a@e2e.local", ad: "E2E Akış A", role: "STUDENT" as const },
  ogrenciB: { email: "e2e-akis-b@e2e.local", ad: "E2E Akış B", role: "STUDENT" as const },
  mezuniyet: { email: "e2e-mezuniyet@e2e.local", ad: "E2E Mezuniyet", role: "STUDENT" as const },
};

/** Akış verisinin sabit adları — testler ekranda bunları arar. */
export const AKIS_VERI = {
  bireyselSablon: "E2E Bireysel Proje",
  takimSablon: "E2E Takım Projesi",
  takimId: "e2e_takim",
  takimAdi: "E2E Takımı",
  adimlar: ["e2e_adim_1", "e2e_adim_2", "e2e_adim_3"] as const,
};

/**
 * Kurulumda oturumu AÇILACAK hesaplar.
 *
 * ⚠️ SEED'İN ONAYLI ÖĞRENCİSİ DE BURADA, ama `E2E_HESAPLARI`'nda DEĞİL:
 * oturumunu paylaşıyoruz, satırını biz kurmuyoruz. İkisini karıştırmak,
 * testin demo hesabın rolünü/durumunu ezmesi olurdu.
 *
 * ⚠️ NEDEN: her testin kendi girişini yapması ölçülebilir biçimde
 * kırılgandı — eşzamanlı girişlerde argon2 doğrulaması CPU'yu tıkıyor ve
 * testler 20 sn sınırına dayanıyordu. Giriş AKIŞININ kendisi
 * `giris.spec.ts`'te iki testle zaten kapsanıyor; oturumun VARLIĞINI
 * gerektiren testlerin ayrıca giriş yapması, ölçtükleri şeye ilgisiz bir
 * yan koşul ekliyordu.
 */
export const OTURUMLAR: { ad: string; email: string }[] = [
  { ad: "ogrenci", email: "student@example.com" },
  // Seed'in admin'i — oturumu paylaşılır, satırı kurulmaz (öğrenciyle aynı kural).
  { ad: "admin", email: "admin@example.com" },
  ...E2E_HESAPLARI.map((h) => ({ ad: h.email.replace(/@.*/, "").replace("e2e-", ""), email: h.email })),
  { ad: "akis-mentor", email: AKIS.mentor.email },
  { ad: "akis-a", email: AKIS.ogrenciA.email },
  { ad: "akis-b", email: AKIS.ogrenciB.email },
];

/**
 * Kurulumda kaydedilen oturum durumunun yolu.
 *
 * ⚠️ Depoya GİRMEZ (`.gitignore`): içinde geçerli bir oturum çerezi var.
 */
export function OTURUM_DOSYASI(ad: string): string {
  return `.oturum/${ad}.json`;
}

/** Seed'in ürettiği admin — mezunun yazabileceği geçerli alıcı. */
export const SEED_ADMIN = "admin@example.com";

/** Kurulumun testlere aktardığı kimlikler (depoya girmez). */
export const KIMLIK_DOSYASI = ".oturum/kimlikler.json";
