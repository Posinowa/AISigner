import { describe, it, expect } from "vitest";
import { mentorBasvuruSchema } from "./basvuru";

/**
 * #287 — mentör başvurusunun sözleşmesi.
 *
 * Bu veri admin'in ONAY kararına ve #288'deki eşleştirme analizine giriyor;
 * yani şemanın gevşek olması kör onaya geri döner.
 */

const gecerli = {
  title: "Senior Backend Developer",
  company: "Posinowa",
  yearsExperience: 7,
  seniority: "senior" as const,
  expertise: ["Backend", "DevOps"],
  capacity: 3,
  weeklyHours: 6,
  motivation: "Kendi başlangıcımda yol gösterecek biri yoktu; o boşluğu doldurmak istiyorum.",
  mentoringStyle: "Önce kendi denemesini isterim, takıldığı yerde birlikte okuruz. Hazır cevap vermem.",
  githubUrl: "https://github.com/ornek",
  linkedinUrl: "",
  city: "Samsun",
};

describe("mentorBasvuruSchema — geçerli başvuru", () => {
  it("eksiksiz başvuru kabul edilir", () => {
    expect(mentorBasvuruSchema.safeParse(gecerli).success).toBe(true);
  });

  it("BOŞ bağlantı hata DEĞİL — doldurmadım demektir", () => {
    // Form her zaman string gönderiyor; boş dizeyi geçersiz saymak
    // isteğe bağlı alanı zorunlu hale getirirdi.
    const sonuc = mentorBasvuruSchema.safeParse({ ...gecerli, githubUrl: "" });

    expect(sonuc.success).toBe(true);
  });
});

describe("mentorBasvuruSchema — reddedilmesi gerekenler", () => {
  it("uzmanlık alanı SEÇİLMEDEN başvurulamaz", () => {
    // Uzmanlık boşsa eşleştirme yapılacak hiçbir şey kalmaz.
    expect(mentorBasvuruSchema.safeParse({ ...gecerli, expertise: [] }).success).toBe(false);
  });

  it("kıdem serbest metin DEĞİL", () => {
    // Eşleştirme ve analiz tek standartla çalışmalı.
    expect(mentorBasvuruSchema.safeParse({ ...gecerli, seniority: "kidemli" }).success).toBe(false);
  });

  it("tek cümlelik mentörlük tarzı yetersiz", () => {
    // Bu alan #288'deki eşleştirmenin en zengin girdisi; "iyiyim" işe yaramaz.
    expect(mentorBasvuruSchema.safeParse({ ...gecerli, mentoringStyle: "İyiyim" }).success).toBe(false);
  });

  it("bozuk bağlantı sessizce kabul edilmez", () => {
    expect(mentorBasvuruSchema.safeParse({ ...gecerli, githubUrl: "github" }).success).toBe(false);
  });

  it("sınırsız kapasite kabul edilmez", () => {
    // Atama ekranı bu sayıyı aşmamalı; 100 stajyer beyan eden mentör
    // kapasiteyi anlamsızlaştırırdı.
    expect(mentorBasvuruSchema.safeParse({ ...gecerli, capacity: 100 }).success).toBe(false);
    expect(mentorBasvuruSchema.safeParse({ ...gecerli, capacity: 0 }).success).toBe(false);
  });
});
