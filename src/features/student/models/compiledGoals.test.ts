import { describe, it, expect } from "vitest";
import { compileGoals, parseCompiledGoals } from "./compiledGoals";

describe("compileGoals + parseCompiledGoals round-trip (#55)", () => {
  it("compile edilen string parse edilince aynı alanları geri verir", () => {
    const fields = {
      knownTech: "HTML/CSS biliyorum, JS'te zorlanıyorum.",
      futureGoal: "Kendi e-ticaret sitemi kurmak istiyorum.",
      learningStyle: "Adım adım, doküman okuyarak ilerlemeyi severim.",
    };

    const compiled = compileGoals(fields);
    const parsed = parseCompiledGoals(compiled);

    expect(parsed).toEqual(fields);
  });

  it("çok satırlı (textarea) içerikle de round-trip çalışır", () => {
    const fields = {
      knownTech: "Satır 1\nSatır 2",
      futureGoal: "Hedef satır 1\nHedef satır 2",
      learningStyle: "Stil satır 1\nStil satır 2",
    };

    const compiled = compileGoals(fields);
    expect(parseCompiledGoals(compiled)).toEqual(fields);
  });

  it("boş alanlarla da round-trip çalışır", () => {
    const fields = { knownTech: "", futureGoal: "", learningStyle: "" };
    expect(parseCompiledGoals(compileGoals(fields))).toEqual(fields);
  });
});

describe("parseCompiledGoals — fallback (#55)", () => {
  it("format eşleşmeyen (eski/serbest metin) veri → ham metin futureGoal'e düşer", () => {
    const legacy = "Sadece basit bir hedef metni, hiç etiket yok.";
    expect(parseCompiledGoals(legacy)).toEqual({
      knownTech: "",
      futureGoal: legacy,
      learningStyle: "",
    });
  });

  it("null / undefined / boş string → tüm alanlar boş", () => {
    expect(parseCompiledGoals(null)).toEqual({ knownTech: "", futureGoal: "", learningStyle: "" });
    expect(parseCompiledGoals(undefined)).toEqual({
      knownTech: "",
      futureGoal: "",
      learningStyle: "",
    });
    expect(parseCompiledGoals("   ")).toEqual({ knownTech: "", futureGoal: "", learningStyle: "" });
  });
});

// #89: Prefill regresyon koruması — kayıtlı goals'ı forma açıp (parse) tekrar
// kaydetmek (compile) ilk kaydı bozmamalı. DB'de saklanan string, prefill sonrası
// yeniden derlendiğinde birebir aynı kalmalı (kullanıcı hiçbir alanı değiştirmezse).
describe("prefill round-trip stabilitesi (#89)", () => {
  it("stored → parse → compile aynı stored string'i üretir (stabil)", () => {
    const original = compileGoals({
      knownTech: "Python temel seviye",
      futureGoal: "Backend geliştirici olmak",
      learningStyle: "Proje yaparak öğrenirim",
    });

    const fieldsFromDb = parseCompiledGoals(original);
    const recompiled = compileGoals(fieldsFromDb);

    expect(recompiled).toBe(original);
    // Ve tekrar parse edilince alanlar hâlâ aynı.
    expect(parseCompiledGoals(recompiled)).toEqual(fieldsFromDb);
  });
});
