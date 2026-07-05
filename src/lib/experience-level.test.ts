import { describe, it, expect } from "vitest";
import {
  normalizeExperienceLevel,
  experienceLevelLabel,
  experienceLevelToFormValue,
  DEFAULT_EXPERIENCE_LEVEL,
} from "@/lib/experience-level";

describe("normalizeExperienceLevel (#54)", () => {
  it("küçük harf form değerlerini kanonik UPPERCASE'e çevirir", () => {
    expect(normalizeExperienceLevel("beginner")).toBe("BEGINNER");
    expect(normalizeExperienceLevel("intermediate")).toBe("INTERMEDIATE");
    expect(normalizeExperienceLevel("advanced")).toBe("ADVANCED");
  });

  it("zaten UPPERCASE olanları korur", () => {
    expect(normalizeExperienceLevel("BEGINNER")).toBe("BEGINNER");
    expect(normalizeExperienceLevel("ADVANCED")).toBe("ADVANCED");
  });

  it("Türkçe etiketleri / AI çıktısını eşler", () => {
    expect(normalizeExperienceLevel("Başlangıç")).toBe("BEGINNER");
    expect(normalizeExperienceLevel("Orta")).toBe("INTERMEDIATE");
    expect(normalizeExperienceLevel("İleri")).toBe("ADVANCED");
    expect(normalizeExperienceLevel("Orta Seviye")).toBe("INTERMEDIATE");
  });

  it("boşluklu/karışık yazımı tolere eder", () => {
    expect(normalizeExperienceLevel("  Advanced  ")).toBe("ADVANCED");
    expect(normalizeExperienceLevel("BeGiNnEr")).toBe("BEGINNER");
  });

  it("tanınmayan/boş değer → DEFAULT (BEGINNER)", () => {
    expect(normalizeExperienceLevel("foo")).toBe(DEFAULT_EXPERIENCE_LEVEL);
    expect(normalizeExperienceLevel("")).toBe(DEFAULT_EXPERIENCE_LEVEL);
    expect(normalizeExperienceLevel(null)).toBe(DEFAULT_EXPERIENCE_LEVEL);
    expect(normalizeExperienceLevel(undefined)).toBe(DEFAULT_EXPERIENCE_LEVEL);
  });
});

describe("experienceLevelLabel (#54)", () => {
  it("her yazımı tek Türkçe etikete indirger", () => {
    expect(experienceLevelLabel("beginner")).toBe("Başlangıç");
    expect(experienceLevelLabel("BEGINNER")).toBe("Başlangıç");
    expect(experienceLevelLabel("intermediate")).toBe("Orta");
    expect(experienceLevelLabel("İleri")).toBe("İleri");
  });

  it("tanınmayan değer → DEFAULT etiketi", () => {
    expect(experienceLevelLabel("xyz")).toBe("Başlangıç");
  });
});

describe("experienceLevelToFormValue (#55)", () => {
  it("kanonik UPPERCASE değeri form'un küçük harf radio değerine çevirir", () => {
    expect(experienceLevelToFormValue("BEGINNER")).toBe("beginner");
    expect(experienceLevelToFormValue("INTERMEDIATE")).toBe("intermediate");
    expect(experienceLevelToFormValue("ADVANCED")).toBe("advanced");
  });

  it("zaten küçük harf veya Türkçe etiket olsa da doğru form değerine çevirir", () => {
    expect(experienceLevelToFormValue("advanced")).toBe("advanced");
    expect(experienceLevelToFormValue("Orta")).toBe("intermediate");
  });

  it("tanınmayan/boş değer → DEFAULT'un form değeri (beginner)", () => {
    expect(experienceLevelToFormValue("xyz")).toBe("beginner");
    expect(experienceLevelToFormValue(null)).toBe("beginner");
    expect(experienceLevelToFormValue(undefined)).toBe("beginner");
  });
});
