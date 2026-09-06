import { describe, it, expect, beforeEach, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));
vi.mock("server-only", () => ({}));

import { projeYukleriniGetir } from "./yuk";

/**
 * #499 — Şablon başına "şu an kaç stajyer çalışıyor".
 *
 * ⚠️ BU TESTLER SQL'İN DOĞRULUĞUNU KANITLAMAZ, eşleme katmanını kanıtlar
 * (mock Prisma sorguyu çalıştırmıyor — #331 ve #452'de aynı sınır yazılıydı).
 * Sorgunun kendisi GERÇEK Postgres'e karşı doğrulandı:
 *
 *   4 üyeli, 1'i AYRILMIŞ bir takım ataması için
 *     toplam üye 4 · aktif üye 3 · sorgunun saydığı 3
 *
 * yani takım üyeleri tek tek sayılıyor ve `leftAt` dolu olan eleniyor.
 */
describe("projeYukleriniGetir", () => {
  beforeEach(() => queryRawMock.mockReset());

  it("satırları şablon kimliğine göre haritalar", async () => {
    queryRawMock.mockResolvedValue([
      { tid: "t1", kisi: 3 },
      { tid: "t2", kisi: 0 },
    ]);

    const h = await projeYukleriniGetir();

    expect(h.get("t1")).toBe(3);
    expect(h.get("t2")).toBe(0);
  });

  it("⚠️ COUNT bigint dönebilir — sayıya çevrilir, yoksa etiket bozulurdu", async () => {
    queryRawMock.mockResolvedValue([{ tid: "t1", kisi: BigInt(7) }]);

    const h = await projeYukleriniGetir();

    expect(h.get("t1")).toBe(7);
    expect(typeof h.get("t1")).toBe("number");
  });

  it("⚠️ hiç ataması olmayan şablon HARİTADA YOK — çağıran 0'a düşer", async () => {
    // Sorgu yalnız ataması olan şablonları döndürür; boş projeler için
    // çağıran `?? 0` kullanıyor. Burada 0 UYDURULMUYOR.
    queryRawMock.mockResolvedValue([{ tid: "t1", kisi: 2 }]);

    const h = await projeYukleriniGetir();

    expect(h.has("bos-sablon")).toBe(false);
    expect(h.get("bos-sablon") ?? 0).toBe(0);
  });

  it("tek sorgu çalışır — şablon başına sorgu YOK", async () => {
    queryRawMock.mockResolvedValue([]);

    await projeYukleriniGetir();

    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });
});

describe("#499 — sorgunun taşıdığı kararlar", () => {
  beforeEach(() => queryRawMock.mockReset());

  /**
   * Sorgu metni burada kilitleniyor. Metin testi davranışı kanıtlamaz ama bu
   * üç karar sessizce kaybolursa sayı yanlış olur ve bu HATA GİBİ GÖRÜNMEZ —
   * yalnızca rakam biraz değişir.
   */
  it("COMPLETED atamalar sayılmaz, GRADUATED/REJECTED stajyerler sayılmaz", async () => {
    queryRawMock.mockResolvedValue([]);
    await projeYukleriniGetir();

    const sorgu = String(queryRawMock.mock.calls[0][0]);
    const kacKez = (metin: string) => sorgu.split(metin).length - 1;

    // ⚠️ HER İKİ DALDA DA olmalı (bireysel + takım). Mutasyon testinde
    // bulundu: filtreyi TEK daldan silmek "metinde geçiyor mu" testinden
    // geçiyordu — bireysel atamalarda mezunlar sayılmaya devam ederdi ve
    // sayı sessizce şişerdi.
    expect(kacKez("<> 'COMPLETED'")).toBe(2);
    expect(kacKez("NOT IN ('GRADUATED', 'REJECTED')")).toBe(2);
  });

  it("⚠️ TAKIM yolu da sorulur ve ayrılmış üye elenir", async () => {
    queryRawMock.mockResolvedValue([]);
    await projeYukleriniGetir();

    const sorgu = String(queryRawMock.mock.calls[0][0]);
    expect(sorgu).toContain("TeamMember");
    expect(sorgu).toContain("leftAt");
  });
});
