import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, recommendMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    studentProfile: { findFirst: vi.fn() },
    mentorProfile: { findUnique: vi.fn() },
    projectTemplate: { findMany: vi.fn() },
  },
  recommendMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/ai/server/project-recommendations", () => ({
  recommendProjects: (...a: unknown[]) => recommendMock(...a),
}));
// Rate limiter: testte hep izin ver.
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: () => ({ allowed: true }) }),
}));

import { POST } from "./route";

function mentor(id = "mentor-1") {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "MENTOR" } } });
}
function req(body: unknown) {
  return new Request("http://t", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ai-recommend-projects (#189)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recommendMock.mockResolvedValue([]);
    // Sistemde değerlendirilecek şablon var (boşsa route 404 döner).
    prismaMock.projectTemplate.findMany.mockResolvedValue([{ id: "t1" }]);
    prismaMock.mentorProfile.findUnique.mockResolvedValue(null);
  });

  it("MENTOR değil → 403", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await POST(req({ studentProfileId: "sp-1" }));
    expect(res.status).toBe(403);
    expect(prismaMock.studentProfile.findFirst).not.toHaveBeenCalled();
  });

  it("geçersiz gövde → 400", async () => {
    mentor();
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("sahiplik: başka mentörün öğrencisi (findFirst null) → 404, AI çağrılmaz", async () => {
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue(null);
    const res = await POST(req({ studentProfileId: "sp-1" }));
    expect(res.status).toBe(404);
    expect(recommendMock).not.toHaveBeenCalled();
    // sorgu mentorId ile sınırlı
    expect(prismaMock.studentProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sp-1", mentorAssignments: { some: { mentorId: "mentor-1" } } } }),
    );
  });

  it("kendi öğrencisi → 200, öneri döner", async () => {
    mentor("mentor-1");
    // #295: Rota, zaten atanmış projeleri aday kümesinden çıkarmak için
    // `assignedProjects`i de okuyor.
    prismaMock.studentProfile.findFirst.mockResolvedValue({
      id: "sp-1",
      mentorId: "mentor-1",
      assignedProjects: [],
    });
    const res = await POST(req({ studentProfileId: "sp-1" }));
    expect(res.status).toBe(200);
    expect(recommendMock).toHaveBeenCalled();
  });

  it("#295: ATANMIŞ projeler aday kümesinden çıkarılır", async () => {
    // Eskiden AI bunlara da slot harcıyordu; arayüz onları gizlediği için
    // mentör 3 yerine 1-2 kullanılabilir öneri görüyordu.
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue({
      id: "sp-1",
      assignedProjects: [{ projectTemplateId: "t9" }],
    });

    await POST(req({ studentProfileId: "sp-1" }));

    expect(prismaMock.projectTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { notIn: ["t9"] } } }),
    );
  });

  it("#295: mentörün UZMANLIĞI öneriye geçirilir", async () => {
    // Mentör süpervize edemeyeceği projeye yol haritası çizemez.
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue({ id: "sp-1", assignedProjects: [] });
    prismaMock.mentorProfile.findUnique.mockResolvedValue({
      expertise: ["Backend"],
      seniority: "senior",
    });

    await POST(req({ studentProfileId: "sp-1" }));

    expect(recommendMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expertise: ["Backend"] }),
    );
  });

  it("#295: HAM hata metni istemciye dönmez", async () => {
    // Eskiden `rootCause` doğrudan gövdeye yazılıyordu; iç hata metni
    // (prompt parçaları dahil olabilir) istemciye sızıyordu.
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockRejectedValue(new Error("SIZAN_IC_DETAY"));

    const res = await POST(req({ studentProfileId: "sp-1" }));
    const govde = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(govde)).not.toContain("SIZAN_IC_DETAY");
  });
});
