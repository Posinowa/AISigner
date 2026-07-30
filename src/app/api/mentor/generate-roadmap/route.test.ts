import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, generateRoadmapMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    assignedProject: { findUnique: vi.fn() },
    roadmap: { delete: vi.fn(), create: vi.fn() },
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
    studentProfile: { mentorId: MENTOR_ID },
    projectTemplate: { title: "Proje" },
    roadmap,
  };
}

describe("generate-roadmap overwrite koruması (#178-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateRoadmapMock.mockResolvedValue([]);
    prismaMock.roadmap.create.mockResolvedValue({ id: "r-new", steps: [] });
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
      studentProfile: { mentorId: "baska-mentor" },
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
