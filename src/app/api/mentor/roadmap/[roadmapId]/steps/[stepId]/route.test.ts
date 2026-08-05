import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmap: { findUnique: vi.fn() },
    roadmapStep: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { PUT, DELETE } from "./route";

function mentor(id: string) {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "MENTOR" } } });
}
const params = (roadmapId = "rm-1", stepId = "s-1") => Promise.resolve({ roadmapId, stepId });
function roadmap(mentorId: string | null) {
  // #195: M:N — mentorId varsa tek elemanlı atama listesi, yoksa boş.
  return {
    id: "rm-1",
    assignedProject: {
      studentProfile: { mentorAssignments: mentorId ? [{ mentorId }] : [] },
    },
  };
}
function putReq(body: unknown) {
  return new Request("http://t", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function delReq(force = false) {
  return new Request(`http://t/api/mentor/roadmap/rm-1/steps/s-1${force ? "?force=true" : ""}`, {
    method: "DELETE",
  });
}

describe("mentor step PUT/DELETE — sahiplik + force (#184)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.roadmapStep.update.mockResolvedValue({ id: "s-1" });
    prismaMock.roadmapStep.delete.mockResolvedValue({});
    prismaMock.roadmapStep.findMany.mockResolvedValue([]);
  });

  // ---- PUT ----
  it("PUT: başka mentörün adımı → 403, güncelleme YOK", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("baska-mentor"));
    const res = await PUT(putReq({ title: "Yeni" }), { params: params() });
    expect(res.status).toBe(403);
    expect(prismaMock.roadmapStep.update).not.toHaveBeenCalled();
  });

  it("PUT: roadmap yok → 404", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(null);
    const res = await PUT(putReq({ title: "Yeni" }), { params: params() });
    expect(res.status).toBe(404);
  });

  it("PUT: kendi öğrencisinin adımı → 200, güncellenir", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    const res = await PUT(putReq({ title: "Güncel Başlık" }), { params: params() });
    expect(res.status).toBe(200);
    expect(prismaMock.roadmapStep.update).toHaveBeenCalled();
  });

  // ---- DELETE ----
  it("DELETE: başka mentörün adımı → 403, silme YOK", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("baska-mentor"));
    const res = await DELETE(delReq(), { params: params() });
    expect(res.status).toBe(403);
    expect(prismaMock.roadmapStep.delete).not.toHaveBeenCalled();
  });

  it("DELETE: TODO adım → silinir", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "TODO" });
    const res = await DELETE(delReq(), { params: params() });
    expect(res.status).toBe(200);
    expect(prismaMock.roadmapStep.delete).toHaveBeenCalledWith({ where: { id: "s-1" } });
  });

  it("DELETE: aktif adım (IN_PROGRESS) force'suz → 409, silme YOK (öğrenci ilerlemesi)", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "IN_PROGRESS" });
    const res = await DELETE(delReq(false), { params: params() });
    expect(res.status).toBe(409);
    expect(prismaMock.roadmapStep.delete).not.toHaveBeenCalled();
  });

  it("DELETE: aktif adım + force=true → silinir", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    prismaMock.roadmapStep.findUnique.mockResolvedValue({ status: "IN_PROGRESS" });
    const res = await DELETE(delReq(true), { params: params() });
    expect(res.status).toBe(200);
    expect(prismaMock.roadmapStep.delete).toHaveBeenCalled();
  });
});
