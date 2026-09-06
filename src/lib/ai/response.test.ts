import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

const { loggerWarnMock, incrementMock } = vi.hoisted(() => ({
  loggerWarnMock: vi.fn(),
  incrementMock: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: loggerWarnMock, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/metrics", () => ({ incrementCounter: incrementMock }));

import { metinAl, jsonAyikla, cozVeDogrula, AiCiktiGecersizError } from "./response";

/** Gemini yanıt gövdesini taklit eder. */
const yanit = (text: string) => ({
  response: { candidates: [{ content: { parts: [{ text }] } }] },
});

const sema = z.object({ ad: z.string(), puan: z.number() });

beforeEach(() => vi.clearAllMocks());

describe("metinAl", () => {
  it("yanıttan metni çıkarır", () => {
    expect(metinAl(yanit("merhaba"))).toBe("merhaba");
  });

  // REGRESYON: istemci normalize `{ text }` döndürüyor. Bu şekil
  // desteklenmediğinde cozVeDogrula kullanan HER modül sessizce boş metin alıp
  // mock'a düşüyordu — üretimde hiç gerçek AI çıktısı kullanılmazdı.
  it("istemcinin NORMALİZE ettiği { text } şeklini okur", () => {
    expect(metinAl({ text: "merhaba" })).toBe("merhaba");
  });

  it("eksik/bozuk yanıtta boş string döner (patlamaz)", () => {
    expect(metinAl({})).toBe("");
    expect(metinAl(null)).toBe("");
    expect(metinAl({ response: { candidates: [] } })).toBe("");
  });
});

describe("jsonAyikla", () => {
  it("```json bloğunu temizler", () => {
    expect(jsonAyikla('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("JSON öncesi/sonrası açıklamayı atar", () => {
    expect(jsonAyikla('İşte sonuç: {"a":1} umarım yardımcı olur')).toBe('{"a":1}');
  });

  it("kök DİZİ olduğunda da çalışır", () => {
    // issue-generator dizi bekliyor; nesne varsayımı onu bozardı.
    expect(jsonAyikla('```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });
});

describe("cozVeDogrula", () => {
  it("geçerli çıktıyı DOĞRULANMIŞ tiple döner", () => {
    const sonuc = cozVeDogrula(yanit('{"ad":"Ali","puan":5}'), sema, "test");
    expect(sonuc).toEqual({ ad: "Ali", puan: 5 });
  });

  it("boş yanıtta hata fırlatır ve düşüşü GÖRÜNÜR yapar", () => {
    expect(() => cozVeDogrula(yanit("  "), sema, "test")).toThrow(AiCiktiGecersizError);
    expect(incrementMock).toHaveBeenCalledWith("ai.test.fallback");
    expect(loggerWarnMock).toHaveBeenCalled();
  });

  it("bozuk JSON'da hata fırlatır", () => {
    expect(() => cozVeDogrula(yanit("{bozuk"), sema, "test")).toThrow(AiCiktiGecersizError);
    expect(incrementMock).toHaveBeenCalledWith("ai.test.fallback.gecersiz-json");
  });

  it("ŞEKİL uyuşmazlığını yakalar — asıl sessiz hata buydu", () => {
    // Geçerli JSON ama beklenen alanlar yok. Öncesi `as` ile geçiyordu ve
    // hata ancak DB'ye yazarken ya da UI'da ortaya çıkıyordu.
    expect(() => cozVeDogrula(yanit('{"baska":"alan"}'), sema, "test")).toThrow(
      AiCiktiGecersizError,
    );
    expect(incrementMock).toHaveBeenCalledWith("ai.test.fallback.sema-uyusmadi");
  });

  it("hata mesajı hangi alanın tutmadığını söyler (teşhis)", () => {
    try {
      cozVeDogrula(yanit('{"ad":"Ali","puan":"beş"}'), sema, "test");
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain("puan");
    }
  });

  it("başarıda başarı sayacı artar", () => {
    cozVeDogrula(yanit('{"ad":"Ali","puan":1}'), sema, "test");
    expect(incrementMock).toHaveBeenCalledWith("ai.test.basarili");
  });
});
