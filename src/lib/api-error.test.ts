import { describe, it, expect } from "vitest";
import { extractApiErrorMessage } from "./api-error";

describe("extractApiErrorMessage (#89)", () => {
  it("düz string hatayı olduğu gibi döner (guard/iş kuralı mesajı)", () => {
    expect(extractApiErrorMessage("Kendi rolünüzü değiştiremezsiniz.", "fallback")).toBe(
      "Kendi rolünüzü değiştiremezsiniz.",
    );
  });

  it("zod fieldErrors objesindeki ilk alanın ilk mesajını çıkarır", () => {
    expect(
      extractApiErrorMessage({ githubRepoUrl: ["Geçerli bir GitHub repository URL'i girin"] }, "fallback"),
    ).toBe("Geçerli bir GitHub repository URL'i girin");
  });

  it("birden fazla alan hatası varsa ilkini döner", () => {
    expect(
      extractApiErrorMessage({ title: ["Başlık gerekli"], description: ["Açıklama gerekli"] }, "fallback"),
    ).toBe("Başlık gerekli");
  });

  it("tanınmayan şekil (null/undefined/boş obje/boş string) → fallback", () => {
    expect(extractApiErrorMessage(null, "fallback")).toBe("fallback");
    expect(extractApiErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(extractApiErrorMessage({}, "fallback")).toBe("fallback");
    expect(extractApiErrorMessage("", "fallback")).toBe("fallback");
    expect(extractApiErrorMessage("   ", "fallback")).toBe("fallback");
  });
});
