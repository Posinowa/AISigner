/**
 * Mentör panosu proje sayaçları (#393).
 *
 * ⚠️ NEDEN AYRI DOSYA: Sayım kuralları sayfanın içinde gömülüydü ve test
 * edilemiyordu. Hatanın kendisi de tam olarak buydu — takım projelerini
 * saymayan bir satır, hiçbir testin uğramadığı bir yerde duruyordu.
 *
 * Saf fonksiyonlar: veri ÇEKMİYORLAR.
 */

export type SayilabilirProje = { id: string; status: string };

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
  ].map((p) => ({ id: p.id, status: p.status }));

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
