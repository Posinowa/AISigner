import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    stepComment: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    roadmapStep: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { PUT, DELETE } from "./route";

function authAs(id: string, role: "MENTOR" | "STUDENT" = "STUDENT", accountStatus = "APPROVED") {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role, accountStatus } } });
}
const params = (stepId = "step-1", commentId = "c-1") => Promise.resolve({ stepId, commentId });
function req(body: unknown) {
  return new Request("http://test", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("yorum düzenle/sil — yetki sınırları (#181) & GRADUATED (#208)", () => {
  beforeEach(() => vi.clearAllMocks());

  // ---- PUT (düzenle) ----
  it("PUT: GRADUATED öğrenci yorum düzenleyemez → 403 (#208)", async () => {
    authAs("student-1", "STUDENT", "GRADUATED");
    prismaMock.stepComment.findUnique.mockResolvedValue({ id: "c-1", stepId: "step-1", authorId: "student-1" });

    const res = await PUT(req({ content: "yeni" }), { params: params() });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Mezun öğrenciler");
    expect(prismaMock.stepComment.update).not.toHaveBeenCalled();
  });

  it("PUT: başkasının yorumu → 403, güncelleme yok", async () => {
    authAs("student-1");
    prismaMock.stepComment.findUnique.mockResolvedValue({ id: "c-1", stepId: "step-1", authorId: "baskasi" });

    const res = await PUT(req({ content: "yeni" }), { params: params() });

    expect(res.status).toBe(403);
    expect(prismaMock.stepComment.update).not.toHaveBeenCalled();
  });

  it("PUT: kendi yorumu → 200, güncellenir", async () => {
    authAs("student-1");
    prismaMock.stepComment.findUnique.mockResolvedValue({ id: "c-1", stepId: "step-1", authorId: "student-1" });
    prismaMock.stepComment.update.mockResolvedValue({ id: "c-1", content: "yeni" });

    const res = await PUT(req({ content: "yeterince uzun yorum" }), { params: params() });

    expect(res.status).toBe(200);
    expect(prismaMock.stepComment.update).toHaveBeenCalled();
  });

  it("PUT: yorum başka adıma aitse → 400", async () => {
    authAs("student-1");
    prismaMock.stepComment.findUnique.mockResolvedValue({ id: "c-1", stepId: "baska-step", authorId: "student-1" });

    const res = await PUT(req({ content: "x" }), { params: params() });

    expect(res.status).toBe(400);
  });

  it("PUT: yorum yoksa → 404", async () => {
    authAs("student-1");
    prismaMock.stepComment.findUnique.mockResolvedValue(null);

    const res = await PUT(req({ content: "x" }), { params: params() });

    expect(res.status).toBe(404);
  });

  // ---- DELETE (sil) ----
  it("DELETE: GRADUATED öğrenci yorum silemez → 403 (#208)", async () => {
    authAs("student-1", "STUDENT", "GRADUATED");
    const res = await DELETE(req({}), { params: params() });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Mezun öğrenciler");
    expect(prismaMock.stepComment.delete).not.toHaveBeenCalled();
  });

  it("DELETE: yorum sahibi → siler", async () => {
    authAs("student-1");
    prismaMock.stepComment.findUnique.mockResolvedValue({ id: "c-1", stepId: "step-1", authorId: "student-1" });

    const res = await DELETE(req({}), { params: params() });

    expect(res.status).toBe(200);
    expect(prismaMock.stepComment.delete).toHaveBeenCalledWith({ where: { id: "c-1" } });
  });

  it("DELETE: öğrencinin mentörü → siler (başkasının yorumu olsa da)", async () => {
    authAs("mentor-1", "MENTOR");
    prismaMock.stepComment.findUnique.mockResolvedValue({ id: "c-1", stepId: "step-1", authorId: "student-1" });
    prismaMock.roadmapStep.findUnique.mockResolvedValue({
      roadmap: { assignedProject: { studentProfile: { mentorAssignments: [{ mentorId: "mentor-1" }] } } },
    });

    const res = await DELETE(req({}), { params: params() });

    expect(res.status).toBe(200);
    expect(prismaMock.stepComment.delete).toHaveBeenCalled();
  });

  it("DELETE: ne sahip ne mentör → 403, silme yok", async () => {
    authAs("baska-mentor", "MENTOR");
    prismaMock.stepComment.findUnique.mockResolvedValue({ id: "c-1", stepId: "step-1", authorId: "student-1" });
    prismaMock.roadmapStep.findUnique.mockResolvedValue({
      roadmap: { assignedProject: { studentProfile: { mentorAssignments: [{ mentorId: "gercek-mentor" }] } } },
    });

    const res = await DELETE(req({}), { params: params() });

    expect(res.status).toBe(403);
    expect(prismaMock.stepComment.delete).not.toHaveBeenCalled();
  });

  it("DELETE: cross-step (yorum bu adıma ait değil) → 400", async () => {
    authAs("student-1");
    prismaMock.stepComment.findUnique.mockResolvedValue({ id: "c-1", stepId: "baska-step", authorId: "student-1" });

    const res = await DELETE(req({}), { params: params() });

    expect(res.status).toBe(400);
    expect(prismaMock.stepComment.delete).not.toHaveBeenCalled();
  });

  it("yetkisiz (guard) → 403, DB'ye gidilmez", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });

    const res = await DELETE(req({}), { params: params() });

    expect(res.status).toBe(403);
    expect(prismaMock.stepComment.findUnique).not.toHaveBeenCalled();
  });
});
