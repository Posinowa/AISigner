// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * "Yazıyor..." sinyali (#354).
 *
 * Kilitlenen davranışlar:
 *  - Sinyalin bir SON KULLANMA tarihi var (gösterge kendiliğinden sönmeli).
 *  - Süresi dolmuş satır okunmuyor (temizlik fırsatçı, tabloda ölü satır olabilir).
 *  - Durdurma idempotent (olmayan sinyali silmek hata değil).
 *  - Okuma TEK sorgu (maliyet bağlı kullanıcı sayısından bağımsız — #329 sözü).
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    typingSignal: {
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { yaziyorIsaretle, yaziyorDurdur, yazanlariGetir, TAZELIK_MS } from "./yaziyor";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.typingSignal.upsert.mockResolvedValue({});
  prismaMock.typingSignal.delete.mockResolvedValue({});
  prismaMock.typingSignal.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.typingSignal.findMany.mockResolvedValue([]);
  // Fırsatçı temizliği kapat: testler onu ayrıca doğruluyor.
  vi.spyOn(Math, "random").mockReturnValue(1);
});

describe("yaziyorIsaretle", () => {
  it("sinyali SON KULLANMA tarihiyle yazar — gösterge kendiliğinden sönmeli", async () => {
    const once = Date.now();
    await yaziyorIsaretle("a", "b");

    const cagri = prismaMock.typingSignal.upsert.mock.calls[0][0];
    expect(cagri.where.fromUserId_toUserId).toEqual({ fromUserId: "a", toUserId: "b" });

    const sure = cagri.create.expiresAt.getTime() - once;
    expect(sure).toBeGreaterThanOrEqual(TAZELIK_MS - 50);
    expect(sure).toBeLessThanOrEqual(TAZELIK_MS + 500);
  });

  it("AYNI satırı günceller — yazma yükü satır biriktirmemeli", async () => {
    await yaziyorIsaretle("a", "b");
    await yaziyorIsaretle("a", "b");
    await yaziyorIsaretle("a", "b");

    // Üç yazma, tek adres: bileşik birincil anahtar.
    expect(prismaMock.typingSignal.upsert).toHaveBeenCalledTimes(3);
    const adresler = prismaMock.typingSignal.upsert.mock.calls.map((c) =>
      JSON.stringify(c[0].where),
    );
    expect(new Set(adresler).size).toBe(1);
  });

  it("tazelemede yalnızca süre uzar", async () => {
    await yaziyorIsaretle("a", "b");
    const cagri = prismaMock.typingSignal.upsert.mock.calls[0][0];
    expect(Object.keys(cagri.update)).toEqual(["expiresAt"]);
  });
});

describe("yaziyorDurdur", () => {
  it("sinyali hemen siler — süre dolmasını beklemek geç kalırdı", async () => {
    await yaziyorDurdur("a", "b");
    expect(prismaMock.typingSignal.delete).toHaveBeenCalledWith({
      where: { fromUserId_toUserId: { fromUserId: "a", toUserId: "b" } },
    });
  });

  it("olmayan sinyali silmek HATA DEĞİL — durdurma idempotent", async () => {
    prismaMock.typingSignal.delete.mockRejectedValue(new Error("not found"));
    await expect(yaziyorDurdur("a", "b")).resolves.toBeUndefined();
  });
});

describe("yazanlariGetir", () => {
  it("SÜRESİ DOLMUŞ satırı okumaz — tabloda ölü satır bulunabilir", async () => {
    await yazanlariGetir(["u1"]);
    const where = prismaMock.typingSignal.findMany.mock.calls[0][0].where;
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it("TEK sorgu — maliyet bağlı kullanıcı sayısından bağımsız", async () => {
    await yazanlariGetir(["u1", "u2", "u3", "u4", "u5"]);
    expect(prismaMock.typingSignal.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.typingSignal.findMany.mock.calls[0][0].where.toUserId.in).toHaveLength(5);
  });

  it("alıcıya göre gruplar", async () => {
    prismaMock.typingSignal.findMany.mockResolvedValue([
      { fromUserId: "a", toUserId: "u1" },
      { fromUserId: "b", toUserId: "u1" },
      { fromUserId: "c", toUserId: "u2" },
    ]);

    const sonuc = await yazanlariGetir(["u1", "u2"]);
    expect(sonuc.get("u1")).toEqual(["a", "b"]);
    expect(sonuc.get("u2")).toEqual(["c"]);
  });

  it("kimse bağlı değilse sorgu ATILMAZ", async () => {
    const sonuc = await yazanlariGetir([]);
    expect(sonuc.size).toBe(0);
    expect(prismaMock.typingSignal.findMany).not.toHaveBeenCalled();
  });
});

describe("fırsatçı temizlik", () => {
  it("her yazmada ÇALIŞMAZ — kozmetik sinyale her tuşta DELETE eklemek olurdu", async () => {
    await yaziyorIsaretle("a", "b");
    expect(prismaMock.typingSignal.deleteMany).not.toHaveBeenCalled();
  });

  it("ara sıra süresi dolanları siler", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    await yaziyorIsaretle("a", "b");
    expect(prismaMock.typingSignal.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it("temizlik hatası sinyali DÜŞÜRMEZ", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    prismaMock.typingSignal.deleteMany.mockRejectedValue(new Error("db"));
    await expect(yaziyorIsaretle("a", "b")).resolves.toBeUndefined();
    expect(prismaMock.typingSignal.upsert).toHaveBeenCalled();
  });
});
