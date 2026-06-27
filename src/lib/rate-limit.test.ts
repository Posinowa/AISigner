import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("limiti aşınca allowed=false döner ve reset sonrası tekrar izin verir", () => {
    const limiter = createRateLimiter("test", { maxRequests: 2, windowSeconds: 60 });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);

    limiter.reset("a");
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("peek sayacı artırmaz", () => {
    const limiter = createRateLimiter("test-peek", { maxRequests: 1, windowSeconds: 60 });
    limiter.peek("b");
    limiter.peek("b");
    expect(limiter.check("b").allowed).toBe(true);
  });
});
