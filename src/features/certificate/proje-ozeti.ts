import { ZORLUK_ETIKETI } from "@/lib/ui/proje-durumu";

/**
 * Sertifikadaki proje satırının metni — TEK KAYNAK.
 *
 * ⚠️ NEDEN: belge iki yüzeyde basılıyor (herkese açık doğrulama sayfası ve
 * stajyerin/admin'in sertifika görünümü). Başlık ve ilerleme metni iki yerde
 * ayrı yazılıydı ve ikisi de "Tamamlanan projeler" diyordu — oysa liste
 * yarım kalmış projeleri de içeriyor. Herkese açık bir belgede bu, işverene
 * yanlış beyan (canlı testte bulundu). İki yüzeyin aynı belgeyi göstermesi
 * doğrulamanın anlamı (#449).
 *
 * İstemci bileşenleri kullanıyor: Prisma ya da `server-only` import etmez.
 */

export const SERTIFIKA_PROJE_BASLIGI = "Staj sürecindeki projeler";

type ProjeSatiri = {
  completedStepsCount: number;
  totalStepsCount: number;
  takimAdi: string | null;
};

/**
 * "2/3 adım" · "3/3 adım tamamlandı" · "Takım A · 2 adım katkı".
 *
 * ⚠️ TAKIMDA ORAN YOK: `completedStepsCount` takımda stajyerin KENDİ
 * katkısı, `totalStepsCount` takımın kapsamı (#449). "2/10" yazmak
 * "projenin %20'si bitti" diye okunurdu; ikisi farklı şeyleri sayıyor.
 */
export function projeIlerlemesi(p: ProjeSatiri): string {
  if (p.takimAdi) return `${p.takimAdi} · ${p.completedStepsCount} adım katkı`;

  const oran = `${p.completedStepsCount}/${p.totalStepsCount} adım`;
  return p.completedStepsCount === p.totalStepsCount ? `${oran} tamamlandı` : oran;
}

/** Zorluk kodunu Türkçe etikete çevirir; bilinmeyen kod olduğu gibi kalır. */
export function zorlukEtiketi(zorluk: string): string {
  return ZORLUK_ETIKETI[zorluk as keyof typeof ZORLUK_ETIKETI]?.label ?? zorluk;
}
