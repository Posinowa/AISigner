import "server-only";
import { prisma } from "@/lib/db";
import { ATAMA_SAHIPLIK_SELECT, mentoruMu } from "@/features/teams/server/sahiplik";

/**
 * Yol haritası adım sıralaması (#406).
 *
 * Adımın sırası bugüne kadar arayüzden HİÇ değiştirilemiyordu: düzenleme formu
 * `title`, `description`, `estimatedHours`, `resources`, `githubIssueUrl`
 * tutuyordu, `order` yoktu. AI üretimi sırayı yanlış kurduğunda mentörün tek
 * çaresi adımı silip yeniden yazmaktı.
 */

export type SiralamaHatasi = "yol-haritasi-yok" | "yetki-yok" | "adim-yok" | "sinirda";

export type SiralamaSonucu =
  | { ok: true; veri: { sira: { id: string; order: number }[] } }
  | { ok: false; neden: SiralamaHatasi };

export type Yon = "yukari" | "asagi";

/**
 * Komşusuyla takas edilmiş diziyi döner.
 *
 * Saf fonksiyon: sınır davranışı (ilk adım yukarı, son adım aşağı) veri
 * çekmeden test edilebilsin diye ayrı duruyor. Sınırda `null` dönüyor —
 * "hiçbir şey yapma" ile "başarıyla taşındı" birbirine karışmasın.
 */
export function komsuylaTakasEt<T>(dizi: T[], indeks: number, yon: Yon): T[] | null {
  const hedef = yon === "yukari" ? indeks - 1 : indeks + 1;
  if (indeks < 0 || indeks >= dizi.length) return null;
  if (hedef < 0 || hedef >= dizi.length) return null;

  const yeni = [...dizi];
  [yeni[indeks], yeni[hedef]] = [yeni[hedef], yeni[indeks]];
  return yeni;
}

/**
 * Bir adımı bir sıra yukarı/aşağı taşır.
 *
 * ⚠️ ADIMIN BU YOL HARİTASINA AİT OLDUĞU DOĞRULANIYOR. Yetki yol haritası
 * üzerinde kuruluyor ama işlem adım üzerinde yapılıyor; ikisi arasındaki bağ
 * sorulmazsa mentör kendi yol haritasının kimliğiyle BAŞKA bir yol
 * haritasının adımını oynatabilirdi. Aynı sınıf hata mevcut PUT/DELETE
 * uçlarında duruyor — #411.
 *
 * ⚠️ SIRA HER YAZMADA 1..n YENİDEN NUMARALANIYOR. Yalnız iki kaydın
 * `order` değerini takas etmek, veride zaten bozuk bir sıra varsa (AI'ın
 * dönebildiği yinelenen/atlamalı `order` değerleri, #410) bozukluğu
 * korurdu. Yeniden numaralandırma bunu yazarken sessizce onarıyor.
 *
 * Tamamı TEK `$transaction` içinde: yarıda kalan bir yeniden numaralandırma
 * sırayı büsbütün bozardı. `(roadmapId, order)` üzerinde benzersizlik kısıtı
 * olmadığı için ara durumda çakışma oluşmuyor.
 */
export async function adimiTasi(params: {
  roadmapId: string;
  stepId: string;
  yon: Yon;
  mentorUserId: string;
}): Promise<SiralamaSonucu> {
  const roadmap = await prisma.roadmap.findUnique({
    where: { id: params.roadmapId },
    select: {
      id: true,
      assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
    },
  });

  if (!roadmap) return { ok: false, neden: "yol-haritasi-yok" };
  if (!mentoruMu(roadmap.assignedProject, params.mentorUserId)) {
    return { ok: false, neden: "yetki-yok" };
  }

  /*
   * Sıralama `order` ile, eşitlikte `createdAt` ile çözülüyor: bozuk veride
   * (iki adımın `order`'ı aynı) sıralama aksi halde kararsız olurdu ve aynı
   * düğmeye iki kez basmak farklı sonuç verebilirdi.
   */
  const adimlar = await prisma.roadmapStep.findMany({
    where: { roadmapId: params.roadmapId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const indeks = adimlar.findIndex((a) => a.id === params.stepId);
  // Adım bu yol haritasında yoksa "adim-yok": başka bir yol haritasındaki
  // adımın VAR OLDUĞU bile sızmasın.
  if (indeks === -1) return { ok: false, neden: "adim-yok" };

  const yeniSira = komsuylaTakasEt(adimlar, indeks, params.yon);
  if (!yeniSira) return { ok: false, neden: "sinirda" };

  await prisma.$transaction(
    yeniSira.map((adim, i) =>
      prisma.roadmapStep.update({
        where: { id: adim.id },
        data: { order: i + 1 },
      }),
    ),
  );

  return { ok: true, veri: { sira: yeniSira.map((a, i) => ({ id: a.id, order: i + 1 })) } };
}
