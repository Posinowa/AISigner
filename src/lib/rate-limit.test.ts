import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock, loggerErrorMock, loggerWarnMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    rateLimit: { findUnique: vi.fn(), deleteMany: vi.fn() },
  },
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { error: loggerErrorMock, warn: loggerWarnMock, info: vi.fn(), debug: vi.fn() },
}));

import { createRateLimiter } from "@/lib/rate-limit";

/** Veritabanının döneceği satırı taklit eder. */
const satir = (count: number, resetMs = 60_000) => [
  { count, resetAt: new Date(Date.now() + resetMs) },
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.rateLimit.deleteMany.mockResolvedValue({ count: 0 });
});

describe("check", () => {
  it("sınır altındayken izin verir", async () => {
    prismaMock.$queryRaw.mockResolvedValue(satir(1));
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    const s = await l.check("a");

    expect(s.allowed).toBe(true);
    expect(s.remaining).toBe(2);
  });

  // SINIR DAVRANIŞI: `count` artırıldıktan SONRAKİ değerdir. maxRequests=3 iken
  // 3. istek GEÇMELİ, 4. bloke olmalı. (Bu bir off-by-one'du: ilk yazımda
  // 3. istek bloke ediliyordu ve suggestions rota testi yakaladı.)
  it("SON izinli istek (count == maxRequests) hâlâ geçer", async () => {
    prismaMock.$queryRaw.mockResolvedValue(satir(3));
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    const s = await l.check("a");

    expect(s.allowed).toBe(true);
    expect(s.remaining).toBe(0);
  });

  it("sınır AŞILINCA reddeder ve retryAfter verir", async () => {
    prismaMock.$queryRaw.mockResolvedValue(satir(4, 45_000));
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    const s = await l.check("a");

    expect(s.allowed).toBe(false);
    expect(s.remaining).toBe(0);
    expect(s.retryAfterSeconds).toBeGreaterThan(0);
  });

  // #322'nin ÇEKİRDEĞİ: okuma ve yazma tek SQL ifadesinde olmalı. Ayrı
  // findUnique + update yapmak, çok instance'ta tam da gidermeye çalıştığımız
  // yarış durumunu geri getirirdi.
  it("sayacı TEK atomik ifadede artırır", async () => {
    prismaMock.$queryRaw.mockResolvedValue(satir(1));
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    await l.check("a");

    expect(prismaMock.$queryRaw).toHaveBeenCalledOnce();
    const sql = prismaMock.$queryRaw.mock.calls[0]![0].join("");
    expect(sql).toContain("INSERT INTO");
    expect(sql).toContain("ON CONFLICT");
  });

  it("limiter adı anahtara giriyor — farklı limiterler birbirini etkilemez", async () => {
    prismaMock.$queryRaw.mockResolvedValue(satir(1));
    await createRateLimiter("login-ip", { maxRequests: 5, windowSeconds: 60 }).check("1.2.3.4");

    // Sablon parametreleri ikinci argumandan itibaren gelir.
    const parametreler = prismaMock.$queryRaw.mock.calls[0]!.slice(1);
    expect(parametreler).toContain("login-ip:1.2.3.4");
  });

  // BİLİNÇLİ KARAR: DB'ye ulaşılamadığında isteği REDDETMEK, kesinti anında
  // tüm girişleri kilitlemek olurdu. Rate-limit savunma-derinliği katmanı;
  // kimlik doğrulamanın kendisi değil.
  it("veritabanı hatasında isteği GEÇİRİR ve durumu loglar", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("db down"));
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    const s = await l.check("a");

    expect(s.allowed).toBe(true);
    // Sessiz geçilmiyor: operasyon bunu görebilmeli.
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});

describe("peek", () => {
  it("sayacı ARTIRMAZ (yalnız okur)", async () => {
    // Kullanımı: bloklanmış kimliği pahalı işe girmeden reddetmek; gerçek
    // deneme `check` ile sayılır. Böylece başarılı girişler sayaca yazılmaz.
    prismaMock.rateLimit.findUnique.mockResolvedValue({
      count: 1,
      resetAt: new Date(Date.now() + 60_000),
    });
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    await l.peek("a");

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("kayıt yoksa izin verir", async () => {
    prismaMock.rateLimit.findUnique.mockResolvedValue(null);
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    expect((await l.peek("a")).allowed).toBe(true);
  });

  it("penceresi GEÇMİŞ kayıt engellemez", async () => {
    prismaMock.rateLimit.findUnique.mockResolvedValue({
      count: 99,
      resetAt: new Date(Date.now() - 1000),
    });
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    expect((await l.peek("a")).allowed).toBe(true);
  });

  it("DB hatasında da geçirir", async () => {
    prismaMock.rateLimit.findUnique.mockRejectedValue(new Error("db down"));
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    expect((await l.peek("a")).allowed).toBe(true);
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});

describe("reset", () => {
  it("kaydı siler", async () => {
    const l = createRateLimiter("login-ip", { maxRequests: 5, windowSeconds: 60 });

    await l.reset("ip:1.2.3.4");

    expect(prismaMock.rateLimit.deleteMany).toHaveBeenCalledWith({
      where: { key: "login-ip:ip:1.2.3.4" },
    });
  });

  it("silme başarısız olursa HATA FIRLATMAZ", async () => {
    // Başarılı girişin ardından çağrılıyor; buradaki bir hata girişi kırmamalı.
    prismaMock.rateLimit.deleteMany.mockRejectedValue(new Error("db down"));
    const l = createRateLimiter("t", { maxRequests: 3, windowSeconds: 60 });

    await expect(l.reset("a")).resolves.toBeUndefined();
    expect(loggerWarnMock).toHaveBeenCalled();
  });
});
