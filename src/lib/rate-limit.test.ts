import { describe, it, expect, vi } from "vitest";
import { createRateLimiter } from "./rate-limit";

/**
 * rate-limit, brute-force / kötüye kullanım korumasının kalbidir.
 * Bu testler sayaç, peek (sayacı artırmama), reset ve pencere sıfırlama
 * davranışlarını doğrular.
 */
describe("createRateLimiter", () => {
  it("limit'e kadar izin verir, sonra bloklar", () => {
    const rl = createRateLimiter("test-basic", { maxRequests: 3, windowSeconds: 60 });
    expect(rl.check("a").allowed).toBe(true); // 1
    expect(rl.check("a").allowed).toBe(true); // 2
    expect(rl.check("a").allowed).toBe(true); // 3
    const blocked = rl.check("a"); // 4 → blok
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("her identifier'ı bağımsız sayar", () => {
    const rl = createRateLimiter("test-independent", { maxRequests: 1, windowSeconds: 60 });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("b").allowed).toBe(true); // farklı anahtar hâlâ serbest
    expect(rl.check("a").allowed).toBe(false);
  });

  it("remaining her istekte azalır", () => {
    const rl = createRateLimiter("test-remaining", { maxRequests: 3, windowSeconds: 60 });
    expect(rl.check("a").remaining).toBe(2);
    expect(rl.check("a").remaining).toBe(1);
    expect(rl.check("a").remaining).toBe(0);
  });

  it("peek sayacı ARTIRMAZ", () => {
    const rl = createRateLimiter("test-peek", { maxRequests: 2, windowSeconds: 60 });
    for (let i = 0; i < 5; i++) expect(rl.peek("a").allowed).toBe(true);
    // peek tüketmediği için tam bütçe durur
    expect(rl.check("a").allowed).toBe(true); // 1
    expect(rl.check("a").allowed).toBe(true); // 2
    expect(rl.check("a").allowed).toBe(false); // 3 → blok
  });

  it("peek limit dolunca bloklu durumu raporlar", () => {
    const rl = createRateLimiter("test-peek-blocked", { maxRequests: 1, windowSeconds: 60 });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.peek("a").allowed).toBe(false);
  });

  it("reset bir identifier'ın sayacını temizler", () => {
    const rl = createRateLimiter("test-reset", { maxRequests: 1, windowSeconds: 60 });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("a").allowed).toBe(false);
    rl.reset("a");
    expect(rl.check("a").allowed).toBe(true); // başarılı giriş sonrası gibi
  });

  it("pencere dolunca otomatik sıfırlanır", () => {
    vi.useFakeTimers();
    try {
      const rl = createRateLimiter("test-window", { maxRequests: 1, windowSeconds: 1 });
      expect(rl.check("a").allowed).toBe(true);
      expect(rl.check("a").allowed).toBe(false);
      vi.advanceTimersByTime(1100); // > 1 sn pencere
      expect(rl.check("a").allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
