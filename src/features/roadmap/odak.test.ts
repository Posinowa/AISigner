import { describe, it, expect } from "vitest";
import {
  oncekiTamamlandi,
  adimKilitli,
  adimEylemeAcik,
  odaktakiAdimIndeksi,
  type OdakAdimi,
} from "./odak";

/**
 * #416 — "şu an hangi adımdayım" kuralı.
 *
 * Kural bugüne kadar iki yerde yaşıyordu (RoadmapSteps içinde gömülü hesap +
 * panodaki "tamamlanmamış ilk adım" satırı). Bu modül tek kaynak.
 */
const a = (...durumlar: string[]): OdakAdimi[] =>
  durumlar.map((s, i) => ({ id: `s${i}`, status: s }));

describe("kilit ve eyleme açıklık", () => {
  it("ilk adım her zaman açık", () => {
    expect(adimKilitli(a("TODO", "TODO"), 0)).toBe(false);
    expect(adimEylemeAcik(a("TODO", "TODO"), 0)).toBe(true);
  });

  it("önceki tamamlanmadıysa sonraki KİLİTLİ", () => {
    expect(adimKilitli(a("TODO", "TODO"), 1)).toBe(true);
    expect(adimEylemeAcik(a("TODO", "TODO"), 1)).toBe(false);
  });

  it("önceki tamamlandıysa sonraki açılır", () => {
    expect(adimKilitli(a("COMPLETED", "TODO"), 1)).toBe(false);
    expect(adimEylemeAcik(a("COMPLETED", "TODO"), 1)).toBe(true);
  });

  it("devam eden adım kilitli DEĞİL ama yeni eylem de başlatılmaz", () => {
    // IN_PROGRESS zaten başlamış; "başlat" eylemi anlamsız.
    expect(adimKilitli(a("IN_PROGRESS"), 0)).toBe(false);
    expect(adimEylemeAcik(a("IN_PROGRESS"), 0)).toBe(false);
  });

  it("⚠️ REVİZYONDAKİ adım sıralamaya rağmen HER ZAMAN eyleme açık (#379)", () => {
    // Mentör düzeltilmesini istiyor; "önceki tamamlanmadı" engel olmamalı,
    // aksi halde 'revize et' demek adımı KİLİTLERDİ.
    expect(adimEylemeAcik(a("IN_PROGRESS", "REVISION_REQUESTED"), 1)).toBe(true);
    expect(adimKilitli(a("IN_PROGRESS", "REVISION_REQUESTED"), 1)).toBe(false);
  });

  it("oncekiTamamlandi yalnız BİR önceki adıma bakar", () => {
    expect(oncekiTamamlandi(a("COMPLETED", "IN_PROGRESS", "TODO"), 2)).toBe(false);
    expect(oncekiTamamlandi(a("IN_PROGRESS", "COMPLETED", "TODO"), 2)).toBe(true);
  });
});

describe("odaktakiAdimIndeksi", () => {
  it("boş yol haritasında null", () => {
    expect(odaktakiAdimIndeksi([])).toBeNull();
  });

  it("hepsi tamamlandıysa null — uydurma görev gösterilmez", () => {
    expect(odaktakiAdimIndeksi(a("COMPLETED", "COMPLETED"))).toBeNull();
  });

  it("eyleme açık ilk adımı seçer", () => {
    expect(odaktakiAdimIndeksi(a("COMPLETED", "TODO", "TODO"))).toBe(1);
  });

  it("devam eden adım, açık TODO'dan önce gelir", () => {
    expect(odaktakiAdimIndeksi(a("IN_PROGRESS", "TODO"))).toBe(0);
  });

  /*
   * ⚠️ Panonun eski kuralı "tamamlanmamış İLK adım"dı ve bu durumu
   * kaçırıyordu: 1. adım devam ederken 2. adım revizyona düşerse mentörün
   * geri gönderdiği iş panoda hiç görünmüyordu.
   */
  it("⚠️ REVİZYON her şeyin önünde — mentör beklemede", () => {
    expect(odaktakiAdimIndeksi(a("IN_PROGRESS", "REVISION_REQUESTED"))).toBe(1);
    expect(odaktakiAdimIndeksi(a("COMPLETED", "TODO", "REVISION_REQUESTED"))).toBe(2);
  });

  it("eski kural bu durumda YANLIŞ adımı seçerdi", () => {
    const adimlar = a("IN_PROGRESS", "REVISION_REQUESTED");
    const eskiKural = adimlar.findIndex((x) => x.status !== "COMPLETED");
    expect(eskiKural).toBe(0);
    expect(odaktakiAdimIndeksi(adimlar)).toBe(1);
  });

  it("KİLİTLİ adım asla odak olmaz", () => {
    // 1. adım IN_PROGRESS -> 2. adım kilitli; odak 1. adım olmalı.
    expect(odaktakiAdimIndeksi(a("IN_PROGRESS", "TODO", "TODO"))).toBe(0);
    // Hiç eyleme açık adım yoksa (ilk adım devam etmiyor ve kilitliyse) null.
    expect(odaktakiAdimIndeksi(a("COMPLETED", "COMPLETED", "COMPLETED"))).toBeNull();
  });
});
