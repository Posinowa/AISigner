import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmapStep: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    assignedProject: { update: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { PATCH } from "./route";

function student(id: string) {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "STUDENT" } } });
}
const params = (stepId = "s-1") => Promise.resolve({ stepId });
function req(body: unknown) {
  return new Request("http://t", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Hedef adım "s-1" (order 1), önünde tamamlanmış "s-0" (order 0).
 * ownerUserId: adımın ait olduğu öğrenci; roadmapStatus: yayın durumu.
 */
function stepGraph(over: {
  ownerUserId: string;
  roadmapStatus?: string;
  targetStatus?: string;
  prevStatus?: string;
}) {
  const target = { id: "s-1", order: 1, status: over.targetStatus ?? "TODO" };
  const prev = { id: "s-0", order: 0, status: over.prevStatus ?? "COMPLETED" };
  return {
    id: "s-1",
    status: target.status,
    roadmapId: "rm-1",
    roadmap: {
      status: over.roadmapStatus ?? "PUBLISHED",
      assignedProjectId: "ap-1",
      assignedProject: {
        id: "ap-1",
        status: "IN_PROGRESS",
        studentProfile: { userId: over.ownerUserId },
      },
      steps: [prev, target],
    },
  };
}

describe("student steps PATCH — IDOR + kurallar (#184)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.roadmapStep.update.mockResolvedValue({ id: "s-1", status: "IN_PROGRESS" });
    prismaMock.roadmapStep.findMany.mockResolvedValue([]);
    prismaMock.assignedProject.update.mockResolvedValue({});
  });

  it("STUDENT değil (guard) → 403, DB'ye gidilmez", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });
    expect(res.status).toBe(403);
    expect(prismaMock.roadmapStep.findUnique).not.toHaveBeenCalled();
  });

  it("IDOR: başka öğrencinin adımı → 403, güncelleme YOK", async () => {
    student("student-1");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(stepGraph({ ownerUserId: "baska-ogrenci" }));

    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });

    expect(res.status).toBe(403);
    expect(prismaMock.roadmapStep.update).not.toHaveBeenCalled();
  });

  it("adım yoksa → 404", async () => {
    student("student-1");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(null);
    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });
    expect(res.status).toBe(404);
  });

  it("geçersiz status (Zod) → 400", async () => {
    student("student-1");
    const res = await PATCH(req({ status: "TODO" }), { params: params() });
    expect(res.status).toBe(400);
    expect(prismaMock.roadmapStep.findUnique).not.toHaveBeenCalled();
  });

  it("roadmap PUBLISHED değilse → 400", async () => {
    student("student-1");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      stepGraph({ ownerUserId: "student-1", roadmapStatus: "DRAFT" }),
    );
    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });
    expect(res.status).toBe(400);
    expect(prismaMock.roadmapStep.update).not.toHaveBeenCalled();
  });

  it("önceki adım tamamlanmadıysa → 400", async () => {
    student("student-1");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      stepGraph({ ownerUserId: "student-1", prevStatus: "IN_PROGRESS" }),
    );
    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });
    expect(res.status).toBe(400);
  });

  it("kendi yayınlanmış adımını başlatma → 200, güncellenir", async () => {
    student("student-1");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(stepGraph({ ownerUserId: "student-1" }));

    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });

    expect(res.status).toBe(200);
    expect(prismaMock.roadmapStep.update).toHaveBeenCalledWith({
      where: { id: "s-1" },
      data: { status: "IN_PROGRESS" },
    });
  });

  it("TODO adımı doğrudan COMPLETED yapmak → 400", async () => {
    student("student-1");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      stepGraph({ ownerUserId: "student-1", targetStatus: "TODO" }),
    );
    const res = await PATCH(req({ status: "COMPLETED" }), { params: params() });
    expect(res.status).toBe(400);
  });

  it("tamamlanmış adımın durumu değiştirilemez → 400", async () => {
    student("student-1");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      stepGraph({ ownerUserId: "student-1", targetStatus: "COMPLETED" }),
    );
    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });
    expect(res.status).toBe(400);
  });
});
