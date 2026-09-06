/**
 * #289: Başvuru formunun seçenek listeleri — TEK kaynak.
 *
 * Önceden listeler `OnboardingForm.tsx` içinde inline duruyordu; AI istemi,
 * admin gösterimi ve form ayrı ayrı kendi sözlüğünü taşıyordu. Eşleştirme
 * ancak iki taraf aynı sözlükten konuşursa çalışır, bu yüzden mentör tarafı
 * da (#287) buradan besleniyor.
 */

export type Secenek = {
  deger: string;
  etiket: string;
  aciklama?: string;
};

/* -- İlgi alanları ------------------------------------------------------ */

/**
 * Liste 5'ten 11'e çıkarıldı. Eski liste (Yapay Zeka & Veri, Web Geliştirme,
 * Mobil, Oyun, Siber Güvenlik) platformun kendi iş akışını bile kapsamıyordu:
 * her şey GitHub üzerinden yürürken **DevOps/Bulut** seçeneği yoktu. Backend
 * de ayrı bir seçenek değildi, "Web Geliştirme" içinde eriyordu.
 */
export const ILGI_ALANLARI: (Secenek & { emoji: string })[] = [
  { deger: "Frontend", etiket: "Frontend", emoji: "🎨", aciklama: "Arayüz, React, tasarım sistemleri" },
  { deger: "Backend", etiket: "Backend", emoji: "⚙️", aciklama: "API, veritabanı, sunucu tarafı" },
  { deger: "Mobile", etiket: "Mobil", emoji: "📱", aciklama: "iOS, Android, React Native" },
  { deger: "AI", etiket: "Yapay Zeka & ML", emoji: "🤖", aciklama: "Model eğitimi, LLM, görüntü işleme" },
  { deger: "Data", etiket: "Veri & Analitik", emoji: "📊", aciklama: "Veri mühendisliği, raporlama" },
  { deger: "DevOps", etiket: "DevOps & Bulut", emoji: "☁️", aciklama: "CI/CD, Docker, dağıtım" },
  { deger: "Cybersecurity", etiket: "Siber Güvenlik", emoji: "🛡️", aciklama: "Sızma testi, güvenli kod" },
  { deger: "Game Dev", etiket: "Oyun Geliştirme", emoji: "🎮", aciklama: "Unity, Unreal, oyun mekanikleri" },
  { deger: "UI/UX", etiket: "UI/UX Tasarım", emoji: "✏️", aciklama: "Kullanıcı deneyimi, prototipleme" },
  { deger: "QA", etiket: "Test & Kalite", emoji: "🔍", aciklama: "Otomasyon testleri, kalite süreçleri" },
  { deger: "Embedded", etiket: "Gömülü & IoT", emoji: "🔌", aciklama: "Mikrodenetleyici, donanım yazılımı" },
];

/**
 * Artık seçilemeyen ama KAYITLI profillerde duran değerler. Gösterimde ham
 * değer görünmesin diye tutuluyor; listeden çıkarmak eski kayıtları bozardı.
 */
const ESKI_ILGI_ETIKETLERI: Record<string, string> = {
  "Web Development": "Web Geliştirme",
};

const ILGI_ETIKETLERI: Record<string, string> = {
  ...Object.fromEntries(ILGI_ALANLARI.map((i) => [i.deger, i.etiket])),
  ...ESKI_ILGI_ETIKETLERI,
};

/** Tanınmayan değer ham hâliyle döner — veri kaybetmektense göstermek yeğdir. */
export function ilgiEtiketi(deger: string): string {
  return ILGI_ETIKETLERI[deger] ?? deger;
}

/* -- Deneyim seviyesi --------------------------------------------------- */

/**
 * Kovaların TANIMI değişti, değerleri değil (`beginner|intermediate|advanced`
 * kanonik kalıyor — AI analizi ve mentör arayüzü bu sözlüğü paylaşıyor).
 *
 * Eski tanımda "İleri = kendi çapımda proje yaptım" deniyordu; bu aslında orta
 * seviye. Üç kova da başlangıç bölgesine sıkışmıştı ve takımda çalışmış,
 * code review almış, canlıya iş çıkarmış profil hiç ölçülemiyordu.
 */
export const DENEYIM_SEVIYELERI: Secenek[] = [
  {
    deger: "beginner",
    etiket: "Yeni başlıyorum",
    aciklama: "Henüz kod yazmadım ya da ilk adımlarımı atıyorum.",
  },
  {
    deger: "intermediate",
    etiket: "Kendi projelerimi yaptım",
    aciklama: "Bir dil/framework ile uçtan uca proje çıkardım.",
  },
  {
    deger: "advanced",
    etiket: "Takımda çalıştım",
    aciklama: "Başkasının kodunu okudum, review aldım/verdim, canlıya iş çıktı.",
  },
];

/* -- Git / GitHub ------------------------------------------------------- */

/**
 * Platformun tüm iş akışı repo + issue + PR üzerinden yürüyor ama bu hiç
 * sorulmuyordu; mentör, stajyerin PR açmayı bilip bilmediğini bilmeden yol
 * haritası çiziyordu. #289'un en büyük boşluğu buydu.
 */
export const GIT_SEVIYELERI: Secenek[] = [
  { deger: "none", etiket: "Hiç kullanmadım", aciklama: "Git'i duydum ama kullanmadım." },
  { deger: "basic", etiket: "commit / push yapabiliyorum", aciklama: "Kendi repoma değişiklik gönderebiliyorum." },
  { deger: "branching", etiket: "branch açıp merge edebiliyorum", aciklama: "Dallanma ve birleştirme akışını biliyorum." },
  { deger: "pr", etiket: "PR açtım, review aldım", aciklama: "Başkasının reposuna katkı verdim." },
];

/* -- İngilizce ---------------------------------------------------------- */

/** Doküman okuma kabiliyeti yol haritasının kaynak seçimini doğrudan etkiliyor. */
export const INGILIZCE_SEVIYELERI: Secenek[] = [
  { deger: "none", etiket: "Yok denecek kadar az" },
  { deger: "reading", etiket: "Dokümantasyon okuyabiliyorum" },
  { deger: "conversational", etiket: "Konuşma seviyesinde" },
  { deger: "fluent", etiket: "Akıcı" },
];

/* -- Eğitim ------------------------------------------------------------- */

export const SINIFLAR: Secenek[] = [
  { deger: "lise", etiket: "Lise" },
  { deger: "hazirlik", etiket: "Hazırlık" },
  { deger: "1", etiket: "1. sınıf" },
  { deger: "2", etiket: "2. sınıf" },
  { deger: "3", etiket: "3. sınıf" },
  { deger: "4", etiket: "4. sınıf" },
  { deger: "mezun", etiket: "Mezun" },
  { deger: "diger", etiket: "Diğer" },
];

/* -- Sayısal sınırlar --------------------------------------------------- */

/**
 * #289 notu: `birthYear` iki yerde FARKLI sınırlanıyordu — `models/onboarding.ts`
 * mevcut yıla kadar izin verirken formun içindeki şema `max(2015)` diyordu.
 * Sınır artık tek yerde.
 */
export const DOGUM_YILI_EN_ERKEN = 1950;
export function dogumYiliEnGec(): number {
  // 15 yaş altı stajyer beklenmiyor; sabit yıl yazmak her yıl bayatlardı.
  return new Date().getFullYear() - 15;
}

/**
 * Haftalık saat. "Tam zamanlı / yarı zamanlı / hafta sonu" kişiden kişiye
 * değişiyordu; saat planlanabilir bir ölçü.
 */
export const HAFTALIK_SAAT_EN_AZ = 1;
export const HAFTALIK_SAAT_EN_COK = 60;

/* -- Mentör tarafı (#287) ----------------------------------------------- */

/**
 * Mentörün kıdemi. Stajyerin `DENEYIM_SEVIYELERI` kovalarıyla KASITLI olarak
 * ayrı: stajyerin ölçüsü "ne öğrenmek istiyor", mentörünki "ne öğretebilir".
 */
export const MENTOR_KIDEMLERI: Secenek[] = [
  { deger: "junior", etiket: "Junior", aciklama: "1-2 yıl profesyonel deneyim." },
  { deger: "mid", etiket: "Mid-level", aciklama: "3-5 yıl; kendi başına iş çıkarıyor." },
  { deger: "senior", etiket: "Senior", aciklama: "6+ yıl; başkalarının kodunu yönlendiriyor." },
  { deger: "lead", etiket: "Lead / Mimar", aciklama: "Takım ve teknik yön belirliyor." },
];

/**
 * Mentörün uzmanlık alanları, stajyerin ilgi alanlarıyla AYNI sözlükten gelir.
 * Eşleştirme ancak iki taraf aynı dili konuşursa çalışır — ayrı listeler
 * tutulsaydı "Backend" ile "Sunucu Tarafı" eşleşmezdi.
 */
export const MENTOR_UZMANLIKLARI = ILGI_ALANLARI;

/** Aynı anda kaç stajyer alabileceği. Atama ekranı bunu aşmamalı. */
export const MENTOR_KAPASITE_EN_AZ = 1;
export const MENTOR_KAPASITE_EN_COK = 10;

/** Toplam profesyonel deneyim (yıl). */
export const MENTOR_DENEYIM_EN_AZ = 0;
export const MENTOR_DENEYIM_EN_COK = 50;
