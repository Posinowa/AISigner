import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ONCEKI_ENV = process.env.NODE_ENV;

/** logger modülü NODE_ENV'i yüklenirken okur → her senaryoda taze import. */
async function loggerYukle(env: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", env);
  return (await import("./logger")).logger;
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NODE_ENV", ONCEKI_ENV ?? "test");
});

describe("logger — üretim", () => {
  it("satır başına TEK ayrıştırılabilir JSON basar", async () => {
    const logger = await loggerYukle("production");

    logger.info("kullanıcı onaylandı", { userId: "u1" });

    expect(logSpy).toHaveBeenCalledOnce();
    const ham = logSpy.mock.calls[0]![0] as string;
    // Toplayıcılar çok satırlı kaydı böler — tek satır olmalı.
    expect(ham).not.toContain("\n");

    const olay = JSON.parse(ham);
    expect(olay.level).toBe("info");
    expect(olay.message).toBe("kullanıcı onaylandı");
    expect(olay.meta).toEqual({ userId: "u1" });
    expect(typeof olay.time).toBe("string");
  });

  it("meta verilmediğinde meta alanını hiç eklemez", async () => {
    const logger = await loggerYukle("production");
    logger.info("sunucu başladı");
    expect(JSON.parse(logSpy.mock.calls[0]![0] as string)).not.toHaveProperty("meta");
  });

  it("debug üretimde susturulur", async () => {
    const logger = await loggerYukle("production");
    logger.debug("ayrıntı");
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("seviyeye göre doğru console kanalını kullanır", async () => {
    const logger = await loggerYukle("production");
    logger.error("patladı");
    logger.warn("dikkat");
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});

describe("logger — geliştirme", () => {
  it("JSON DEĞİL, okunaklı metin basar", async () => {
    const logger = await loggerYukle("development");

    logger.info("merhaba", { a: 1 });

    const ilk = logSpy.mock.calls[0]![0] as string;
    expect(ilk).toContain("[INFO] merhaba");
    expect(() => JSON.parse(ilk)).toThrow();
    // meta ikinci argüman olarak gider (terminalde açılabilir nesne).
    expect(logSpy.mock.calls[0]![1]).toEqual({ a: 1 });
  });

  it("debug geliştirmede görünür", async () => {
    const logger = await loggerYukle("development");
    logger.debug("ayrıntı");
    expect(logSpy).toHaveBeenCalledOnce();
  });
});
