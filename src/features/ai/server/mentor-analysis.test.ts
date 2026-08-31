// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #288 — mentör analizi sözleşmesi.
 *
 * Bu analiz admin'in ONAY ve EŞLEŞTİRME kararına giriyor. İki şey kritik:
 * - model çökse bile bir değerlendirme dönmeli (başvuru AI yüzünden kaybolmaz)
 * - dönen şekil her zaman TAM olmalı; eksik alan kaydetmeyi ve gösterimi bozar
 */

const { modelMock } = vi.hoisted(() => ({ modelMock: vi.fn() }));

vi.mock("@/lib/ai/gemini-client", () => ({
  getModel: () => ({ generateContent: modelMock }),
}));

import { analyzeMentorProfile, mentorYedekAnalizi } from "./mentor-analysis";

const girdi = {
  title: "Senior Backend Developer",
  company: "Posinowa",
  yearsExperience: 7,
  seniority: "senior",
  expertise: ["Backend", "DevOps"],
  capacity: 3,
  weeklyHours: 6,
  motivation: "Kendi başlangıcımda yol gösterecek biri yoktu.",
  mentoringStyle: "Önce kendi denemesini isterim.",
  city: "Samsun",
};

const yanit = (metin: string) => ({
  // #335: istemci artik normalize `{ text }` donduruyor (SDK sekli disari sizmiyor).
  text: metin,
});

const tamJson = JSON.stringify({
  level: "İleri",
  summary: "GERCEK AI OZETI",
  strengths: ["a", "b"],
  technicalTracks: ["Backend"],
  idealStudentProfile: "Backend'e ilgi duyan stajyerler.",
  matchingNotes: ["not1"],
});

beforeEach(() => vi.clearAllMocks());

describe("analyzeMentorProfile — normal yol", () => {
  it("geçerli JSON dönerse GERÇEK analiz kullanılır", async () => {
    modelMock.mockResolvedValue(yanit(tamJson));

    const sonuc = await analyzeMentorProfile(girdi);

    expect(sonuc.summary).toBe("GERCEK AI OZETI");
    expect(sonuc.level).toBe("İleri");
  });

  it("JSON etrafındaki AÇIKLAMA metni ayıklanır", async () => {
    // Model bazen fence kullanmadan düz metin araya sıkıştırıyor.
    // Bu, kod bloğu soymadan AYRI bir mekanizmayla (parantez arası kesme)
    // çözülüyor; ikisi de ayrı ayrı test altında olmalı.
    modelMock.mockResolvedValue(
      yanit("İşte değerlendirme: " + tamJson + " Umarım yardımcı olur."),
    );

    expect((await analyzeMentorProfile(girdi)).summary).toBe("GERCEK AI OZETI");
  });

  it("kod bloğuna sarılmış JSON ayrıştırılır", async () => {
    // Model sık sık ```json ile sarıyor; bu yaygın durum sessizce yedeğe düşmemeli.
    modelMock.mockResolvedValue(yanit("```json\n" + tamJson + "\n```"));

    expect((await analyzeMentorProfile(girdi)).summary).toBe("GERCEK AI OZETI");
  });
});

describe("analyzeMentorProfile — model işbirliği yapmazsa", () => {
  it("model HATA fırlatırsa başvuru kaybolmaz, yedek döner", async () => {
    modelMock.mockRejectedValue(new Error("kota doldu"));

    const sonuc = await analyzeMentorProfile(girdi);

    expect(sonuc.summary.length).toBeGreaterThan(0);
    expect(sonuc.summary).not.toBe("GERCEK AI OZETI");
  });

  it("BOZUK JSON yedeğe düşer, çökmez", async () => {
    modelMock.mockResolvedValue(yanit("bu json değil"));

    await expect(analyzeMentorProfile(girdi)).resolves.toBeTruthy();
  });

  it("UYDURMA seviye kabul edilmez", async () => {
    // Stajyer analiziyle aynı sözlük kullanılmalı ki admin yan yana okuyabilsin.
    modelMock.mockResolvedValue(
      yanit(JSON.stringify({ ...JSON.parse(tamJson), level: "Efsanevi" })),
    );

    expect(["Başlangıç", "Orta", "İleri"]).toContain(
      (await analyzeMentorProfile(girdi)).level,
    );
  });

  it("EKSİK alanlı yanıt tamamlanır — şekil her zaman tam", async () => {
    // Eksik alan kaydetmeyi ve gösterimi bozardı.
    modelMock.mockResolvedValue(
      yanit(JSON.stringify({ level: "Orta", summary: "kısa özet" })),
    );

    const sonuc = await analyzeMentorProfile(girdi);

    expect(Array.isArray(sonuc.strengths)).toBe(true);
    expect(Array.isArray(sonuc.technicalTracks)).toBe(true);
    expect(Array.isArray(sonuc.matchingNotes)).toBe(true);
    expect(typeof sonuc.idealStudentProfile).toBe("string");
    expect(sonuc.idealStudentProfile.length).toBeGreaterThan(0);
  });
});

describe("mentorYedekAnalizi — beyandan türetilen değerlendirme", () => {
  it("deneyim yılına göre seviye verir", () => {
    expect(mentorYedekAnalizi({ ...girdi, yearsExperience: 8 }).level).toBe("İleri");
    expect(mentorYedekAnalizi({ ...girdi, yearsExperience: 4 }).level).toBe("Orta");
    expect(mentorYedekAnalizi({ ...girdi, yearsExperience: 1 }).level).toBe("Başlangıç");
  });

  it("uzmanlık HAM değerle değil, etiketiyle yazılır", () => {
    // Admin panelinde "Backend" yerine kod değeri görünmemeli.
    const sonuc = mentorYedekAnalizi({ ...girdi, expertise: ["AI"] });
    expect(sonuc.summary).toContain("Yapay Zeka & ML");
  });

  it("uzmanlık YOKSA eşleştirme önerisi UYDURULMAZ", () => {
    const sonuc = mentorYedekAnalizi({ ...girdi, expertise: [] });
    expect(sonuc.idealStudentProfile).toMatch(/üretilemedi/);
  });

  it("kapasite ve saat eşleştirme notlarına girer", () => {
    const sonuc = mentorYedekAnalizi(girdi);
    expect(sonuc.matchingNotes.join(" ")).toContain("6");
    expect(sonuc.matchingNotes.join(" ")).toContain("3");
  });
});
