/**
 * Admin kullanıcı listesinin kategori tanımları (#443 sonrası sayfalama).
 *
 * ⚠️ TEK KAYNAK — ve bu dosyanın VAR OLMA SEBEBİ bu.
 *
 * Kategoriler bugüne kadar `admin-dashboard/page.tsx` içinde İKİ KEZ elle
 * yazılıydı: bir kez `filteredUsers`'ın filtresinde, bir kez `stats`'ın
 * sayımında. İkisi tesadüfen uyuşuyordu çünkü ikisi de AYNI tam listeyi
 * geziyordu. Sayfalamayla birlikte liste sunucudan filtreli, sayılar da
 * sunucudan toplu geliyor — iki ayrı sorgu. Tanım tek yerde olmazsa
 * "MENTOR" sekmesi 7 satır gösterip rozetinde 9 yazar ve bu HATA OLARAK
 * GÖRÜNMEZ, sadece sayılar tutmaz (#393'ün aynısı).
 *
 * ⚠️ Bu dosya `server-only` DEĞİL ve prisma İMPORT ETMİYOR: kategoriler
 * arayüzün sekme etiketlerinde de kullanılıyor. Prisma tipine bağlamak
 * sunucu kodunu istemci paketine sürüklerdi (#432'de `analytics/sabitler.ts`
 * aynı sebeple ayrılmıştı).
 */

export const KULLANICI_KATEGORILERI = [
  "ALL",
  "PENDING",
  "APPROVED",
  "GRADUATED",
  "REJECTED",
  "MENTOR",
  // #250: Onay bekleyen başvuru henüz "mentör" değil — ayrı tutuluyor,
  // aksi halde başvuru mevcut mentörlerin arasında kaybolurdu.
  "MENTOR_BASVURU",
  // #259: E-postasını henüz doğrulamamış hesaplar.
  "DOGRULANMAMIS",
  "ADMIN",
  // Takım üyesi seçici (#332) tüm stajyerleri istiyor — duruma bakmadan.
  // Panelde bir sekmesi YOK; yalnız API tüketicisi için var.
  "STUDENT",
] as const;

export type KullaniciKategorisi = (typeof KULLANICI_KATEGORILERI)[number];

/**
 * Panelde SEKMESİ OLAN kategoriler (#489).
 *
 * ⚠️ `"STUDENT"` DIŞARIDA: yukarıda yazdığı gibi onun bir sekmesi yok, yalnız
 * takım üyesi seçicisi (#332) için var. Panel bu tipi kendi içinde elle
 * sayıyordu; `Exclude` ile bağlamak, yeni bir kategori eklendiğinde panelin
 * de otomatik haberdar olmasını sağlıyor — iki listeyi elle eşit tutmaya
 * çalışmak bu kod tabanında tekrar eden hata sınıfı (#448'de aynısı
 * kategori tanımında yaşandı).
 */
export type PanelKategorisi = Exclude<KullaniciKategorisi, "STUDENT">;

export function gecerliKategori(deger: unknown): KullaniciKategorisi {
  return KULLANICI_KATEGORILERI.includes(deger as KullaniciKategorisi)
    ? (deger as KullaniciKategorisi)
    : "ALL";
}

/**
 * Kategorinin Prisma `where` karşılığı.
 *
 * Dönen nesne `Prisma.UserWhereInput` ile uyumlu ama tipi BİLEREK gevşek:
 * bu modül prisma import etmiyor (yukarıdaki nota bakın). Sunucu tarafı
 * onu kendi tipine daraltıyor.
 */
export function kategoriKosulu(
  kategori: KullaniciKategorisi,
): Record<string, unknown> {
  switch (kategori) {
    case "PENDING":
      return { role: "STUDENT", accountStatus: "PENDING" };
    case "APPROVED":
      return { role: "STUDENT", accountStatus: "APPROVED" };
    case "GRADUATED":
      return { role: "STUDENT", accountStatus: "GRADUATED" };
    case "REJECTED":
      return { role: "STUDENT", accountStatus: "REJECTED" };
    case "MENTOR":
      return { role: "MENTOR", accountStatus: { not: "PENDING" } };
    case "MENTOR_BASVURU":
      return { role: "MENTOR", accountStatus: "PENDING" };
    case "ADMIN":
      return { role: "ADMIN" };
    // `dogrulandiMi` bir Date'in varlığına bakıyor; SQL karşılığı NULL kontrolü.
    case "DOGRULANMAMIS":
      return { emailVerified: null };
    case "STUDENT":
      return { role: "STUDENT" };
    case "ALL":
      return {};
  }
}

/**
 * Serbest metin araması — ad, soyad ve e-posta.
 *
 * ⚠️ ARAMA SUNUCUDA. Sayfalama gelince istemci tarafı arama yalnız YÜKLÜ
 * SAYFAYI tarardı: kullanıcı var olan bir kaydı arayıp "sonuç yok" görür ve
 * aramaktan vazgeçerdi. Sayfalamanın en sinsi yan etkisi bu.
 *
 * ⚠️ SORGU KELİMELERE BÖLÜNÜYOR ve her kelime ayrı ayrı aranıyor.
 *
 * İstemci sürümü `${name} ${lastName}` BİRLEŞİK metninde arıyordu, yani
 * "Ayşe Yılmaz" çalışıyordu. Alanları ayrı ayrı arayan naif bir sunucu
 * karşılığı bunu SESSİZCE kırardı: "Ayşe Yılmaz" ne `name`'e ne
 * `lastName`'e uyar. Her kelimenin en az bir alana uyması aranıyor (AND of
 * ORs) — bu eski davranışı koruyor ve üstüne ters sırayı ("Yılmaz Ayşe")
 * da yakalıyor.
 *
 * `mode: "insensitive"` Postgres'te ILIKE'a çevriliyor; istemcideki
 * `toLowerCase().includes()` karşılığı.
 */
export function aramaKosulu(q: string): Record<string, unknown> | null {
  const kelimeler = q.trim().split(/\s+/).filter(Boolean);
  if (kelimeler.length === 0) return null;

  return {
    AND: kelimeler.map((k) => ({
      OR: [
        { email: { contains: k, mode: "insensitive" } },
        { name: { contains: k, mode: "insensitive" } },
        { lastName: { contains: k, mode: "insensitive" } },
      ],
    })),
  };
}

/**
 * Panelin sayaç bloğu.
 *
 * ⚠️ TİP BURADA, `server/user.ts`'te DEĞİL. Onu üreten fonksiyon prisma
 * çekiyor; tipini oradan import etmek sunucu modülünü istemci paketinin
 * bağımlılık grafiğine sokardı (#432'de `analytics/sabitler.ts` aynı
 * sebeple ayrılmıştı). Şekil düz veri, prisma tipine ihtiyacı yok.
 */
export type KullaniciSayilari = {
  total: number;
  studentCount: number;
  activeStudents: number;
  graduatedCount: number;
  pendingCount: number;
  rejectedCount: number;
  mentorCount: number;
  mentorBasvuruCount: number;
  adminCount: number;
  dogrulanmamisCount: number;
  studentsWithoutMentor: number;
};

/** Sayaçların ilk yükleme öncesi hali — yanlış sayı yerine sıfır. */
export const BOS_SAYILAR: KullaniciSayilari = {
  total: 0,
  studentCount: 0,
  activeStudents: 0,
  graduatedCount: 0,
  pendingCount: 0,
  rejectedCount: 0,
  mentorCount: 0,
  mentorBasvuruCount: 0,
  adminCount: 0,
  dogrulanmamisCount: 0,
  studentsWithoutMentor: 0,
};
