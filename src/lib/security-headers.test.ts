import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "./security-headers";

describe("Content-Security-Policy", () => {
  it("ÜRETİMDE 'unsafe-eval' İÇERMEZ", () => {
    // Regresyon: üretimde eval'e izin vermek, bir XSS'in string'den kod
    // üretmesine izin vermek demek. Üretim bundle'ının eval'e ihtiyacı yok.
    expect(buildContentSecurityPolicy(false)).not.toContain("unsafe-eval");
  });

  it("geliştirmede 'unsafe-eval' içerir (HMR/react-refresh gerektiriyor)", () => {
    expect(buildContentSecurityPolicy(true)).toContain("unsafe-eval");
  });

  it("iki ortam arasındaki TEK fark 'unsafe-eval'dir", () => {
    const dev = buildContentSecurityPolicy(true);
    const prod = buildContentSecurityPolicy(false);
    expect(dev.replace(" 'unsafe-eval'", "")).toBe(prod);
  });

  it("temel kısıtlamaları her iki ortamda da korur", () => {
    for (const csp of [buildContentSecurityPolicy(true), buildContentSecurityPolicy(false)]) {
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    }
  });
});

describe("buildSecurityHeaders", () => {
  it("beklenen başlıkların tamamını gönderir", () => {
    const adlar = buildSecurityHeaders(false).map((h) => h.key);
    expect(adlar).toEqual([
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "X-XSS-Protection",
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "Permissions-Policy",
    ]);
  });

  it("clickjacking'i iki katmanda birden engeller", () => {
    const h = buildSecurityHeaders(false);
    expect(h.find((x) => x.key === "X-Frame-Options")?.value).toBe("DENY");
    expect(h.find((x) => x.key === "Content-Security-Policy")?.value).toContain(
      "frame-ancestors 'none'",
    );
  });
});
