import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock, analyzeMock } = vi.hoisted(() => ({
  prismaMock: {
    profileAnalysis: { upsert: vi.fn(), findUnique: vi.fn() },
  },
  analyzeMock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("./profile-analysis", () => ({ analyzeStudentProfile: analyzeMock }));

import {
  generateAndPersistProfileAnalysis,
  getStoredProfileAnalysis,
} from "./profile-analysis-store";

const analysisResult = {
  level: "Orta",
  tracks: ["Frontend", "Backend"],
  summary: "özet",
  strengths: ["hızlı öğrenir"],
  developmentAreas: ["test yazımı"],
  recommendedPath: "önce temel sonra proje",
  recommendations: ["oku", "yaz"],
};

describe("profile-analysis-store (#47)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeMock.mockResolvedValue(analysisResult);
    prismaMock.profileAnalysis.upsert.mockResolvedValue({ id: "pa-1" });
  });

  it("analiz üretilip upsert edilir; tracks → technicalTracks eşlenir", async () => {
    const res = await generateAndPersistProfileAnalysis("sp-1", {
      experienceLevel: "INTERMEDIATE",
      interests: ["Web"],
    });

    expect(res).toBe(analysisResult);
    expect(prismaMock.profileAnalysis.upsert).toHaveBeenCalledOnce();
    const arg = prismaMock.profileAnalysis.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ studentProfileId: "sp-1" });
    expect(arg.create.technicalTracks).toEqual(["Frontend", "Backend"]);
    expect(arg.create.strengths).toEqual(["hızlı öğrenir"]);
    expect(arg.update.recommendedPath).toBe("önce temel sonra proje");
  });

  it("getStoredProfileAnalysis findUnique ile okur", async () => {
    prismaMock.profileAnalysis.findUnique.mockResolvedValue({ id: "pa-1" });

    const res = await getStoredProfileAnalysis("sp-1");

    expect(prismaMock.profileAnalysis.findUnique).toHaveBeenCalledWith({
      where: { studentProfileId: "sp-1" },
    });
    expect(res).toEqual({ id: "pa-1" });
  });
});
