import { describe, it, expect } from "vitest";
import { extractApiErrorMessage } from "./api-error-message";

const FALLBACK = "İşlem başarısız.";

describe("extractApiErrorMessage (#114)", () => {
  it("düz string hatayı aynen döner (guard/iş kuralı mesajları)", () => {
    expect(
      extractApiErrorMessage({ error: "Kendi rolünüzü değiştiremezsiniz." }, FALLBACK),
    ).toBe("Kendi rolünüzü değiştiremezsiniz.");
  });

  it("zod fieldErrors objesinden ilk mesajı döner", () => {
    const body = { error: { title: ["Başlık gerekli"], description: ["Açıklama gerekli"] } };
    expect(extractApiErrorMessage(body, FALLBACK)).toBe("Başlık gerekli");
  });

  it("boş string hatada fallback döner", () => {
    expect(extractApiErrorMessage({ error: "" }, FALLBACK)).toBe(FALLBACK);
    expect(extractApiErrorMessage({ error: "   " }, FALLBACK)).toBe(FALLBACK);
  });

  it("boş fieldErrors objesinde/boş dizilerde fallback döner", () => {
    expect(extractApiErrorMessage({ error: {} }, FALLBACK)).toBe(FALLBACK);
    expect(extractApiErrorMessage({ error: { title: [] } }, FALLBACK)).toBe(FALLBACK);
  });

  it("gövde null/undefined/bozuk ise fallback döner (json parse fail senaryosu)", () => {
    expect(extractApiErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(extractApiErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(extractApiErrorMessage("duz metin govde", FALLBACK)).toBe(FALLBACK);
    expect(extractApiErrorMessage({}, FALLBACK)).toBe(FALLBACK);
  });

  it("error alanı beklenmeyen tipteyse (sayı/bool) fallback döner", () => {
    expect(extractApiErrorMessage({ error: 42 }, FALLBACK)).toBe(FALLBACK);
    expect(extractApiErrorMessage({ error: true }, FALLBACK)).toBe(FALLBACK);
  });

  it("fieldErrors dizi olmayan değer içerse de String'e çevirip döner", () => {
    expect(extractApiErrorMessage({ error: { userId: "Kullanıcı ID gerekli" } }, FALLBACK)).toBe(
      "Kullanıcı ID gerekli",
    );
  });
});
