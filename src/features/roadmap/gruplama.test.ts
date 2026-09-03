import { describe, it, expect } from "vitest";
import { adimlariGrupla } from "./gruplama";

const a = (...durumlar: string[]) => durumlar.map((s, i) => ({ id: `s${i}`, status: s }));

/**
 * #417: Tamamlanan adımlar katlanır.
 *
 * Ölçüm: tamamlanmış adım kartı açık adımla aynı boyutta (~300px); kilitli
 * adım zaten 116px'e iniyordu. 10 adımlı yol haritasında 6 tamamlanmış adım
 * ≈ 1800px gereksiz yükseklik.
 */
describe("adimlariGrupla", () => {
  it("boş listede boş döner", () => {
    expect(adimlariGrupla([])).toEqual([]);
  });

  it("hiç tamamlanmamışsa her adım ayrı kalır", () => {
    const g = adimlariGrupla(a("TODO", "IN_PROGRESS"));
    expect(g).toHaveLength(2);
    expect(g.every((x) => x.tip === "adim")).toBe(true);
  });

  it("baştaki ardışık tamamlananlar tek gruba iner", () => {
    const g = adimlariGrupla(a("COMPLETED", "COMPLETED", "IN_PROGRESS"));
    expect(g).toHaveLength(2);
    expect(g[0].tip).toBe("tamamlanmis");
    if (g[0].tip === "tamamlanmis") expect(g[0].adimlar).toHaveLength(2);
    expect(g[1].tip).toBe("adim");
  });

  it("tek tamamlanmış adım da gruplanır — 300px'lik kart bir satıra iner", () => {
    const g = adimlariGrupla(a("COMPLETED", "TODO"));
    expect(g[0].tip).toBe("tamamlanmis");
    if (g[0].tip === "tamamlanmis") expect(g[0].adimlar).toHaveLength(1);
  });

  /*
   * ⚠️ Adımlar genelde sırayla bitiyor ama zorunlu değil: bir adım revizyona
   * düşerken sonraki tamamlanmış olabilir. Hepsini tek yere toplamak zaman
   * çizgisini bozardı.
   */
  it("⚠️ ARDIŞIK OLMAYAN tamamlananlar AYRI gruplarda kalır", () => {
    const g = adimlariGrupla(a("COMPLETED", "REVISION_REQUESTED", "COMPLETED"));
    expect(g).toHaveLength(3);
    expect(g[0].tip).toBe("tamamlanmis");
    expect(g[1].tip).toBe("adim");
    expect(g[2].tip).toBe("tamamlanmis");
  });

  it("⚠️ REVİZYON istenen adım gruba GİRMEZ (#379)", () => {
    const g = adimlariGrupla(a("COMPLETED", "REVISION_REQUESTED"));
    if (g[0].tip === "tamamlanmis") {
      expect(g[0].adimlar.map((x) => x.status)).toEqual(["COMPLETED"]);
    }
    expect(g[1].tip).toBe("adim");
  });

  /*
   * ⚠️ Kilit kuralı (`odak.ts`) adımın YOL HARİTASINDAKİ yerine bakıyor.
   * Gruplama indeksleri kaydırırsa kilitler yanlış hesaplanır.
   */
  it("⚠️ ORİJİNAL indeksler korunur", () => {
    const g = adimlariGrupla(a("COMPLETED", "COMPLETED", "TODO", "TODO"));
    if (g[0].tip === "tamamlanmis") expect(g[0].indeksler).toEqual([0, 1]);
    expect(g[1].tip === "adim" && g[1].indeks).toBe(2);
    expect(g[2].tip === "adim" && g[2].indeks).toBe(3);
  });

  /*
   * ⚠️ BAŞTA OLMAYAN grup ayrıca test ediliyor: ilk grupta `basla === 0`
   * olduğu için indeksleri sıfırdan sayan hatalı bir uygulama AYNI sonucu
   * veriyor ve testten geçiyordu (mutasyon testinde ölçüldü).
   */
  it("⚠️ ortadaki grubun indeksleri de kaymaz", () => {
    const g = adimlariGrupla(a("IN_PROGRESS", "COMPLETED", "COMPLETED", "TODO"));
    expect(g[0].tip === "adim" && g[0].indeks).toBe(0);
    if (g[1].tip === "tamamlanmis") expect(g[1].indeksler).toEqual([1, 2]);
    expect(g[2].tip === "adim" && g[2].indeks).toBe(3);
  });

  it("hiçbir adım kaybolmaz", () => {
    const adimlar = a("COMPLETED", "TODO", "COMPLETED", "COMPLETED", "IN_PROGRESS");
    const g = adimlariGrupla(adimlar);
    const sayi = g.reduce((t, x) => t + (x.tip === "adim" ? 1 : x.adimlar.length), 0);
    expect(sayi).toBe(adimlar.length);
  });

  it("grup anahtarı ilk adımın kimliğinden türer", () => {
    const g = adimlariGrupla(a("TODO", "COMPLETED"));
    if (g[1].tip === "tamamlanmis") expect(g[1].anahtar).toBe("tamamlanmis-s1");
  });
});
