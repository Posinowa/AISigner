import { describe, it, expect, afterEach } from "vitest";
import { getClientIp, BILINMEYEN_IP } from "./client-ip";

const ONCEKI_HOPS = process.env.TRUSTED_PROXY_HOPS;

afterEach(() => {
  if (ONCEKI_HOPS === undefined) delete process.env.TRUSTED_PROXY_HOPS;
  else process.env.TRUSTED_PROXY_HOPS = ONCEKI_HOPS;
});

describe("getClientIp", () => {
  it("tek vekilde XFF'nin EN SAĞINI alır (istemcinin uydurduğunu değil)", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(getClientIp(h)).toBe("203.0.113.9");
  });

  it("saldırgan başa sahte IP eklese de sonuç DEĞİŞMEZ (limit atlatılamaz)", () => {
    const ilk = getClientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }));
    const ikinci = getClientIp(new Headers({ "x-forwarded-for": "2.2.2.2, 203.0.113.9" }));
    expect(ilk).toBe(ikinci);
    expect(ilk).toBe("203.0.113.9");
  });

  it("TRUSTED_PROXY_HOPS=2 ile sağdan ikinciyi alır (CDN + LB)", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.1" });
    expect(getClientIp(h)).toBe("203.0.113.9");
  });

  it("zincir beklenenden kısaysa en soldakine düşer (hiç limitlememekten iyi)", () => {
    process.env.TRUSTED_PROXY_HOPS = "5";
    const h = new Headers({ "x-forwarded-for": "203.0.113.9" });
    expect(getClientIp(h)).toBe("203.0.113.9");
  });

  it("geçersiz TRUSTED_PROXY_HOPS değerinde 1'e düşer", () => {
    process.env.TRUSTED_PROXY_HOPS = "sıfır-değil-ki";
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(getClientIp(h)).toBe("203.0.113.9");
  });

  it("XFF yoksa x-real-ip'e düşer", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("XFF varken x-real-ip'e BAKMAZ", () => {
    const h = new Headers({
      "x-forwarded-for": "6.6.6.6, 203.0.113.9",
      "x-real-ip": "6.6.6.6",
    });
    expect(getClientIp(h)).toBe("203.0.113.9");
  });

  it("boş/virgüllü artık XFF'yi yok sayıp x-real-ip'e düşer", () => {
    const h = new Headers({ "x-forwarded-for": " , ,", "x-real-ip": "203.0.113.9" });
    expect(getClientIp(h)).toBe("203.0.113.9");
  });

  it("hiçbir başlık yoksa BILINMEYEN_IP döner", () => {
    expect(getClientIp(new Headers())).toBe(BILINMEYEN_IP);
    expect(getClientIp(undefined)).toBe(BILINMEYEN_IP);
  });

  it("düz nesne başlıkları da okur (NextAuth authorize req.headers)", () => {
    expect(getClientIp({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })).toBe("203.0.113.9");
    expect(getClientIp({ "x-real-ip": ["203.0.113.9"] })).toBe("203.0.113.9");
  });
});
