import { describe, it, expect } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import manifest from "@/app/manifest";

describe("SEO, Robots, Sitemap and Manifest Metadata", () => {
  it("robots.ts: public rotalara izin verir, korumalı rotaları engeller", () => {
    const r = robots();
    expect(r.rules).toBeDefined();

    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toContain("/");
    expect(rule.allow).toContain("/signin");
    expect(rule.allow).toContain("/signup");

    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    expect(disallow).toContain("/admin-dashboard");
    expect(disallow).toContain("/mentor-dashboard");
    expect(disallow).toContain("/student-dashboard");
    expect(disallow).toContain("/api/");

    expect(r.sitemap).toContain("/sitemap.xml");
  });

  it("sitemap.ts: public sayfaları doğru öncelik ve sıklıkla listeler", () => {
    const s = sitemap();
    expect(Array.isArray(s)).toBe(true);
    expect(s.length).toBeGreaterThanOrEqual(5);

    const urls = s.map((item) => item.url);
    expect(urls.some((u) => u.endsWith("/signin"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/signup"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/terms"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/privacy"))).toBe(true);

    const homeItem = s.find((item) => !item.url.endsWith("/signin") && !item.url.endsWith("/signup") && !item.url.endsWith("/terms") && !item.url.endsWith("/privacy") && !item.url.endsWith("/forgot-password"));
    expect(homeItem?.priority).toBe(1.0);
  });

  it("manifest.ts: geçerli PWA ve tema yapılandırması döner", () => {
    const m = manifest();
    expect(m.name).toContain("AISigner");
    expect(m.short_name).toBe("AISigner");
    expect(m.theme_color).toBe("#4338ca");
    expect(m.display).toBe("standalone");
    expect(m.icons?.length).toBeGreaterThan(0);
  });
});
