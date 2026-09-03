import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, generateRoadmapMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    assignedProject: { findUnique: vi.fn() },
    roadmap: { delete: vi.fn(), create: vi.fn() },
    // #410: Kayıtlı profil analizi prompt'a giriyor.
    profileAnalysis: { findUnique: vi.fn() },
  },
  generateRoadmapMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/ai/server/generate-roadmap", () => ({
  generateRoadmap: (...a: unknown[]) => generateRoadmapMock(...a),
}));
// Rate limiter: testte hep izin ver.
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: () => ({ allowed: true }) }),
}));
// #321: KVKK rizasi — varsayilan olarak VAR; ayri bir test yoklugunu olcuyor.
const { rizaMock } = vi.hoisted(() => ({ rizaMock: vi.fn() }));
vi.mock("@/features/kvkk/riza", () => ({
  profilSahibininRizasiVar: (...a: unknown[]) => rizaMock(...a),
}));

import { POST } from "./route";

const MENTOR_ID = "mentor-1";
function mentor() {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: MENTOR_ID, role: "MENTOR" } } });
}
function req(body: unknown) {
  return new Request("http://test/api/mentor/generate-roadmap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
/** Bu mentöre ait, verilen roadmap durumuyla atanmış proje. */
function assignedProject(roadmap: { id: string; status: string } | null) {
  return {
    id: "ap-1",
    // #195: M:N — bu mentöre atanmış öğrenci.
    // #410: `id` de gerekiyor — kayıtlı profil analizi onunla okunuyor.
    studentProfile: { id: "sp-1", mentorAssignments: [{ mentorId: MENTOR_ID }] },
    projectTemplate: { title: "Proje" },
    roadmap,
  };
}

describe("generate-roadmap overwrite koruması (#178-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateRoadmapMock.mockResolvedValue([]);
    prismaMock.roadmap.create.mockResolvedValue({ id: "r-new", steps: [] });
    prismaMock.profileAnalysis.findUnique.mockResolvedValue(null);
    rizaMock.mockResolvedValue(true);
  });

  // #321 KVKK: islemi MENTOR tetikliyor ama veri OGRENCIYE ait. Ogrencinin
  // rizasi yoksa profil verisi Vertex AI'ya (ABD) gonderilmemeli.
  it("öğrencinin KVKK rızası yoksa 403 döner ve AI ÇAĞRILMAZ", async () => {
    mentor();
    prismaMock.assignedProject.findUnique.mockResolvedValue(assignedProject(null));
    rizaMock.mockResolvedValue(false);

    const res = await POST(req({ assignedProjectId: "ap-1" }));

    expect(res.status).toBe(403);
    expect((await res.json()).rizaGerekli).toBe(true);
    expect(generateRoadmapMock).not.toHaveBeenCalled();
  });

  it("MENTOR değil → guard yanıtı döner (403)", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await POST(req({ assignedProjectId: "ap-1" }));
    expect(res.status).toBe(403);
    expect(prismaMock.assignedProject.findUnique).not.toHaveBeenCalled();
  });

  it("başkasının öğrencisi → 403", async () => {
    mentor();
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      ...assignedProject(null),
      studentProfile: { mentorAssignments: [{ mentorId: "baska-mentor" }] },
    });
    const res = await POST(req({ assignedProjectId: "ap-1" }));
    expect(res.status).toBe(403);
  });

  it("PUBLISHED roadmap + overwrite → 409, SİLME YAPILMAZ (öğrenci ilerlemesi korunur)", async () => {
    mentor();
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      assignedProject({ id: "r-1", status: "PUBLISHED" }),
    );

    const res = await POST(req({ assignedProjectId: "ap-1", overwrite: true }));

    expect(res.status).toBe(409);
    expect(prismaMock.roadmap.delete).not.toHaveBeenCalled();
    expect(prismaMock.roadmap.create).not.toHaveBeenCalled();
  });

  it("DRAFT roadmap + overwrite → eski silinir, yenisi üretilir", async () => {
    mentor();
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      assignedProject({ id: "r-1", status: "DRAFT" }),
    );

    const res = await POST(req({ assignedProjectId: "ap-1", overwrite: true }));

    expect(res.status).toBe(200);
    expect(prismaMock.roadmap.delete).toHaveBeenCalledWith({ where: { id: "r-1" } });
    expect(prismaMock.roadmap.create).toHaveBeenCalled();
  });

  it("roadmap var + overwrite yok → 400, silme yok", async () => {
    mentor();
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      assignedProject({ id: "r-1", status: "DRAFT" }),
    );

    const res = await POST(req({ assignedProjectId: "ap-1" }));

    expect(res.status).toBe(400);
    expect(prismaMock.roadmap.delete).not.toHaveBeenCalled();
  });

  it("overwrite boolean değilse → 400 (Zod)", async () => {
    mentor();
    const res = await POST(req({ assignedProjectId: "ap-1", overwrite: "evet" }));
    expect(res.status).toBe(400);
  });
});

/**
 * #410: Kayıtlı profil analizi (#47) üretime GEÇİYOR.
 *
 * ⚠️ Bu girdi bugüne kadar hiç kullanılmıyordu: prompt yalnız seviye, ilgi
 * alanları ve hedefleri görüyordu, oysa platform her stajyer için
 * `strengths`, `developmentAreas`, `recommendedPath` üretip saklıyordu.
 */
describe("profil analizi üretime geçiyor (#410)", () => {
  const analiz = {
    strengths: ["Hızlı öğreniyor"],
    developmentAreas: ["Test yazma zayıf"],
    recommendedPath: "Önce testler.",
    // Şemada olan ama üretime GEÇMEYEN alanlar — kapsam bilinçli dar.
    level: "BEGINNER",
    summary: "özet",
    technicalTracks: ["backend"],
    recommendations: ["öneri"],
  };

  beforeEach(() => {
    // Kurulum üstteki describe'ın beforeEach'inde; bu blok kendi kurulumunu
    // yapmak zorunda (mock değerleri testler arasında sızmasın).
    vi.clearAllMocks();
    mentor();
    generateRoadmapMock.mockResolvedValue([]);
    prismaMock.roadmap.create.mockResolvedValue({ id: "r-new", steps: [] });
    prismaMock.assignedProject.findUnique.mockResolvedValue(assignedProject(null));
    rizaMock.mockResolvedValue(true);
  });

  it("⚠️ analiz VARSA generateRoadmap'e üçüncü argüman olarak geçer", async () => {
    prismaMock.profileAnalysis.findUnique.mockResolvedValue(analiz);

    await POST(req({ assignedProjectId: "ap-1" }));

    const ucuncu = generateRoadmapMock.mock.calls[0][2];
    expect(ucuncu).toEqual({
      strengths: ["Hızlı öğreniyor"],
      developmentAreas: ["Test yazma zayıf"],
      recommendedPath: "Önce testler.",
    });
  });

  it("⚠️ analiz YOKSA null geçer, üretim ÇÖKMEZ (#352 — rıza geri alınınca silinir)", async () => {
    prismaMock.profileAnalysis.findUnique.mockResolvedValue(null);

    const res = await POST(req({ assignedProjectId: "ap-1" }));

    expect(res.status).toBe(200);
    expect(generateRoadmapMock.mock.calls[0][2]).toBeNull();
  });

  it("analiz ÖĞRENCİNİN profiline göre okunuyor", async () => {
    prismaMock.profileAnalysis.findUnique.mockResolvedValue(analiz);

    await POST(req({ assignedProjectId: "ap-1" }));

    expect(prismaMock.profileAnalysis.findUnique).toHaveBeenCalledWith({
      where: { studentProfileId: "sp-1" },
    });
  });
});
