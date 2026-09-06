/**
 * Mentör panosu proje sayaçları (#393).
 *
 * ⚠️ NEDEN AYRI DOSYA: Sayım kuralları sayfanın içinde gömülüydü ve test
 * edilemiyordu. Hatanın kendisi de tam olarak buydu — takım projelerini
 * saymayan bir satır, hiçbir testin uğramadığı bir yerde duruyordu.
 *
 * Saf fonksiyonlar: veri ÇEKMİYORLAR.
 */

export type SayilabilirProje = {
  id: string;
  status: string;
  /** #405: Yol haritası taslakta mı — panoda işaretlemek için. */
  roadmap?: { id: string; status: string } | null;
};

export type SayilabilirOgrenci = {
  studentProfile?: {
    assignedProjects?: SayilabilirProje[];
    teamMemberships?: { team: { assignedProjects: SayilabilirProje[] } }[];
  } | null;
};

const TAMAMLANDI = "COMPLETED";

/**
 * Öğrencinin TÜM projeleri — bireysel + takım.
 *
 * ⚠️ Takım atamasında `AssignedProject.studentProfileId` NULL, sahiplik
 * `teamId` üzerinde (#332). Yalnız `assignedProjects`'e bakan sürüm, takımı
 * olup bireysel projesi olmayan stajyeri "0 aktif proje" sayıyordu.
 *
 * Kimlikle tekilleştirilir: aynı proje iki yoldan gelirse bir kez sayılsın.
 */
export function ogrencininProjeleri(ogrenci: SayilabilirOgrenci): SayilabilirProje[] {
  const profil = ogrenci.studentProfile;
  if (!profil) return [];

  const hepsi = [
    ...(profil.assignedProjects ?? []),
    ...(profil.teamMemberships ?? []).flatMap((u) => u.team.assignedProjects),
  ].map((p) => ({ id: p.id, status: p.status, roadmap: p.roadmap ?? null }));

  return [...new Map(hepsi.map((p) => [p.id, p])).values()];
}

export function aktifProjeSayisi(ogrenci: SayilabilirOgrenci): number {
  return ogrencininProjeleri(ogrenci).filter((p) => p.status !== TAMAMLANDI).length;
}

export function tamamlananProjeSayisi(ogrenci: SayilabilirOgrenci): number {
  return ogrencininProjeleri(ogrenci).filter((p) => p.status === TAMAMLANDI).length;
}

/**
 * Panel toplamı — PROJE başına, öğrenci başına DEĞİL.
 *
 * ⚠️ Bir takım projesi üç üyenin de projesidir; öğrenci başına toplarsak tek
 * proje üç kez sayılır ve panel gerçekte olmayan bir iş hacmi gösterir.
 * Öğrenci kartındaki sayı ise doğru şekilde 1 kalır: o proje gerçekten onun.
 */
export function benzersizProjeSayisi(
  ogrenciler: SayilabilirOgrenci[],
  aktifMi: boolean,
): number {
  const idler = new Set<string>();
  for (const o of ogrenciler) {
    for (const p of ogrencininProjeleri(o)) {
      if (aktifMi ? p.status !== TAMAMLANDI : p.status === TAMAMLANDI) idler.add(p.id);
    }
  }
  return idler.size;
}

/**
 * Taslak yol haritası olan BENZERSİZ proje sayısı (#405).
 *
 * Tekilleştirme yol haritası kimliğiyle. `Roadmap.assignedProjectId`
 * `@unique` olduğu için proje kimliğiyle saymak AYNI sonucu verir — yani
 * bu bir koruma değil, adlandırma tercihi: uyarı "kaç proje" değil "kaç yol
 * haritası yayınlanmayı bekliyor" sorusunu yanıtlıyor, anahtar da onu adıyla
 * ansın. (Mutasyon testinde ölçüldü: iki anahtar aynı sayıyı üretiyor.)
 *
 * ⚠️ Takım yol haritası BİR KEZ sayılıyor: o proje üç üyenin de listesinden
 * geliyor ve öğrenci başına toplamak tek taslağı üç kez sayardı (#393).
 *
 * Yol haritası OLMAYAN proje sayılmaz: o ayrı bir durum ("rota çizilmemiş"),
 * taslak değil.
 */
export function taslakYolHaritasiSayisi(ogrenciler: SayilabilirOgrenci[]): number {
  const idler = new Set<string>();
  for (const o of ogrenciler) {
    for (const p of ogrencininProjeleri(o)) {
      if (p.roadmap && p.roadmap.status === "DRAFT") idler.add(p.roadmap.id);
    }
  }
  return idler.size;
}
