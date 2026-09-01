// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #352 — mentör başvurusunda KVKK açık rıza kapısı.
 *
 * EN KRİTİK İDDİA: rıza yoksa mentörün serbest metin cevapları
 * (`motivation`, `mentoringStyle`) Vertex AI'ya, yani ABD'ye GİTMEZ.
 * #321 bu mekanizmayı kurmuştu ama yalnızca stajyer akışlarına uygulanmıştı;
 * mentör başvurusu açıkta kalmıştı.
 *
 * İKİNCİ İDDİA: rıza yokluğu başvuruyu ENGELLEMEZ. Açık rıza özgür iradeyle
 * verilmeli; vermeyen kişi mentör olamıyorsa rıza özgür sayılmaz.
 */

const { sessionMock, prismaMock, rizaMock, analizMock, loggerMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  prismaMock: { mentorProfile: { upsert: vi.fn() } },
  rizaMock: vi.fn(),
  analizMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("next-auth", () => ({ getServerSession: sessionMock }));
vi.mock("@/lib/auth/nextauth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/features/kvkk/riza", () => ({ aiRizasiVar: rizaMock }));
vi.mock("@/features/ai/server/mentor-analysis-store", () => ({
  generateAndPersistMentorAnalysis: analizMock,
}));

import { saveMentorBasvuru } from "./basvuru";

const gecerliForm = {
  title: "Senior Backend Developer",
  company: "Acme",
  yearsExperience: 8,
  seniority: "senior",
  expertise: ["backend"],
  capacity: 2,
  weeklyHours: 5,
  motivation: "Stajyer yetiştirmeyi seviyorum ve bilgimi aktarmak istiyorum.",
  mentoringStyle: "Uygulamalı, kod incelemesi ağırlıklı ilerlerim.",
  githubUrl: "",
  linkedinUrl: "",
  city: "İstanbul",
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: "m1", role: "MENTOR" } });
  prismaMock.mentorProfile.upsert.mockResolvedValue({ id: "mp1" });
  rizaMock.mockResolvedValue(true);
  analizMock.mockResolvedValue({});
});

describe("KVKK rıza kapısı", () => {
  it("rıza YOKSA analiz üretilmez — veri yurt dışına ÇIKMAZ", async () => {
    rizaMock.mockResolvedValue(false);

    await saveMentorBasvuru(gecerliForm);

    expect(analizMock).not.toHaveBeenCalled();
  });

  it("rıza yokken BAŞVURU YİNE KAYDEDİLİR", async () => {
    // Rıza vermeyen kişi mentör olamıyorsa, o rıza özgür sayılmaz.
    rizaMock.mockResolvedValue(false);

    await saveMentorBasvuru(gecerliForm);

    expect(prismaMock.mentorProfile.upsert).toHaveBeenCalled();
  });

  it("rıza VARSA analiz üretilir", async () => {
    await saveMentorBasvuru(gecerliForm);

    expect(analizMock).toHaveBeenCalledWith(
      "mp1",
      expect.objectContaining({
        motivation: gecerliForm.motivation,
        mentoringStyle: gecerliForm.mentoringStyle,
      }),
    );
  });

  it("rıza OTURUMDAKİ kullanıcı için sorgulanır", async () => {
    // Gövdeden gelen bir kimliğe güvenilseydi kapı atlatılabilirdi.
    await saveMentorBasvuru(gecerliForm);

    expect(rizaMock).toHaveBeenCalledWith("m1");
  });
});

describe("yetki ve doğrulama", () => {
  it("oturum yoksa çalışmaz", async () => {
    sessionMock.mockResolvedValue(null);

    await expect(saveMentorBasvuru(gecerliForm)).rejects.toThrow();
    expect(prismaMock.mentorProfile.upsert).not.toHaveBeenCalled();
  });

  it("MENTOR olmayan rol başvuru kaydedemez", async () => {
    sessionMock.mockResolvedValue({ user: { id: "s1", role: "STUDENT" } });

    await expect(saveMentorBasvuru(gecerliForm)).rejects.toThrow();
    expect(prismaMock.mentorProfile.upsert).not.toHaveBeenCalled();
  });

  it("geçersiz form kaydedilmez", async () => {
    await expect(saveMentorBasvuru({ title: "x" })).rejects.toThrow();
    expect(prismaMock.mentorProfile.upsert).not.toHaveBeenCalled();
  });
});

describe("dayanıklılık", () => {
  it("analiz üretimi patlarsa başvuru KAYITLI kalır", async () => {
    analizMock.mockRejectedValue(new Error("model yok"));

    await expect(saveMentorBasvuru(gecerliForm)).resolves.toBeUndefined();
    expect(prismaMock.mentorProfile.upsert).toHaveBeenCalled();
  });
});
