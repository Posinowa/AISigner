import { describe, it, expect, vi, beforeEach } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));

import { adimOzetleriniGetir, BOS_OZET } from "./adim-ozeti";

/**
 * #452 — Toplama veritabanında.
 *
 * ⚠️ BU TESTLER SQL'İN DOĞRULUĞUNU KANITLAMAZ, eşleme katmanını kanıtlar
 * (mock Prisma SQL'i çalıştırmıyor — #331'de aynı sınır yazılıydı). Sorgunun
 * kendisi GERÇEK Postgres'e karşı doğrulandı: 1406 atamalık veride eski
 * (adımları JS'te sayan) sürümle yeni sürümün yanıtları bayt bayt
 * karşılaştırıldı ve TÜM alanlarda aynı çıktı.
 */
describe("adimOzetleriniGetir", () => {
  beforeEach(() => queryRawMock.mockReset());

  it("⚠️ boş listede SORGU AÇMAZ — `IN ()` geçersiz SQL", async () => {
    const sonuc = await adimOzetleriniGetir([]);
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(sonuc.size).toBe(0);
  });

  it("satırları yol haritası kimliğine göre haritalar", async () => {
    const t = new Date("2026-09-01T10:00:00.000Z");
    queryRawMock.mockResolvedValue([
      { roadmapId: "r1", toplam: 7, tamamlanan: 3, sonHareket: t, sonBaslik: "API" },
    ]);
    const h = await adimOzetleriniGetir(["r1"]);
    expect(h.get("r1")).toEqual({
      toplamAdim: 7,
      tamamlanan: 3,
      sonHareketAt: t,
      sonBaslik: "API",
    });
  });

  it("⚠️ COUNT bigint dönebilir — sayıya çevrilir, yoksa yüzde hesabı NaN olurdu", async () => {
    queryRawMock.mockResolvedValue([
      { roadmapId: "r1", toplam: BigInt(4), tamamlanan: BigInt(1), sonHareket: null, sonBaslik: null },
    ]);
    const ozet = (await adimOzetleriniGetir(["r1"])).get("r1")!;
    expect(ozet.toplamAdim).toBe(4);
    expect(ozet.tamamlanan).toBe(1);
    expect(typeof ozet.toplamAdim).toBe("number");
  });

  it("⚠️ adımı olmayan yol haritası HARİTADA YOK — çağıran BOS_OZET'e düşer", async () => {
    queryRawMock.mockResolvedValue([
      { roadmapId: "r1", toplam: 2, tamamlanan: 0, sonHareket: null, sonBaslik: null },
    ]);
    const h = await adimOzetleriniGetir(["r1", "r2"]);
    expect(h.has("r2")).toBe(false);
    expect(h.get("r2") ?? BOS_OZET).toEqual(BOS_OZET);
  });

  it("BOS_OZET 'adım yok' demektir — %0 ile karıştırılmasın (#432)", () => {
    expect(BOS_OZET).toEqual({
      toplamAdim: 0,
      tamamlanan: 0,
      sonHareketAt: null,
      sonBaslik: null,
    });
  });

  it("istenen tüm kimlikler tek sorguda gider — atama başına sorgu YOK", async () => {
    queryRawMock.mockResolvedValue([]);
    await adimOzetleriniGetir(["r1", "r2", "r3", "r4"]);
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });
});
