import { describe, it, expect, beforeEach, vi } from "vitest";

const { getModelMock } = vi.hoisted(() => ({ getModelMock: vi.fn() }));
vi.mock("@/lib/ai/gemini-client", () => ({ getModel: getModelMock }));

import { analyzeStudentProfile } from "./profile-analysis";

const input = {
  experienceLevel: "BEGINNER",
  interests: ["Web Development", "AI"],
  goals: "Full-stack olmak",
};

function modelReturning(json: unknown) {
  return {
    generateContent: vi.fn().mockResolvedValue({
      response: { candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] },
    }),
  };
}

describe("analyzeStudentProfile — genişletilmiş sonuç (#47)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AI hata verirse fallback tüm yeni alanları içerir", async () => {
    getModelMock.mockImplementation(() => {
      throw new Error("AI down");
    });

    const res = await analyzeStudentProfile(input);

    expect(res.level).toBeTruthy();
    expect(Array.isArray(res.tracks)).toBe(true);
    expect(res.strengths.length).toBeGreaterThan(0);
    expect(res.developmentAreas.length).toBeGreaterThan(0);
    expect(typeof res.recommendedPath).toBe("string");
    expect(res.recommendedPath.length).toBeGreaterThan(0);
    expect(res.recommendations.length).toBeGreaterThan(0);
  });

  it("tam JSON dönerse tüm alanlar korunur", async () => {
    getModelMock.mockReturnValue(
      modelReturning({
        level: "İleri",
        tracks: ["Backend"],
        summary: "özet",
        strengths: ["algoritma"],
        developmentAreas: ["test yazımı"],
        recommendedPath: "önce X sonra Y",
        recommendations: ["oku", "yaz"],
      }),
    );

    const res = await analyzeStudentProfile(input);

    expect(res.level).toBe("İleri");
    expect(res.strengths).toEqual(["algoritma"]);
    expect(res.developmentAreas).toEqual(["test yazımı"]);
    expect(res.recommendedPath).toBe("önce X sonra Y");
  });

  it("model yeni alanları üretmezse güvenli varsayılanlar atanır", async () => {
    getModelMock.mockReturnValue(
      modelReturning({
        level: "Orta",
        tracks: ["Frontend"],
        summary: "özet",
        recommendations: ["oku"],
        // strengths / developmentAreas / recommendedPath yok
      }),
    );

    const res = await analyzeStudentProfile(input);

    expect(res.strengths).toEqual([]);
    expect(res.developmentAreas).toEqual([]);
    expect(res.recommendedPath).toBe("");
    expect(res.level).toBe("Orta");
  });
});
