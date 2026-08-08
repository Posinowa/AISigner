import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Bağımlılıkları mock'la (gerçek DB / oturum gerekmez) ---
// vi.mock fabrikleri dosya başına hoist edilir; bu yüzden mock'ları vi.hoisted ile tanımlıyoruz.
const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmapStep: { findUnique: vi.fn() },
    stepComment: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

const STUDENT_USER = "student-1";
const MENTOR_USER = "mentor-1";

/** Erişim kontrolü için getStepWithAccess'in döndüğü step objesini taklit eder. */
function buildStep(status: "DRAFT" | "PUBLISHED") {
  return {
    id: "step-1",
    roadmap: {
      status,
      assignedProject: {
        studentProfile: { userId: STUDENT_USER, mentorAssignments: [{ mentorId: MENTOR_USER }] },
      },
    },
  };
}

function authAs(userId: string, role: "STUDENT" | "MENTOR") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: userId, role } },
  });
}

function makeRequest(body: unknown) {
  return new Request("http://test/api/steps/step-1/comments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ stepId: "step-1" }) };

describe("POST /api/steps/[stepId]/comments — taslak (DRAFT) guard (#52/#69)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("öğrenci + DRAFT roadmap → 403 döner ve yorum oluşturulmaz", async () => {
    authAs(STUDENT_USER, "STUDENT");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("DRAFT"));

    const res = await POST(makeRequest({ content: "merhaba" }), ctx);

    expect(res.status).toBe(403);
    expect(prismaMock.stepComment.create).not.toHaveBeenCalled();
  });

  it("öğrenci + PUBLISHED roadmap → 201, yorum oluşturulur", async () => {
    authAs(STUDENT_USER, "STUDENT");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("PUBLISHED"));
    prismaMock.stepComment.create.mockResolvedValue({ id: "c-1", content: "merhaba" });

    const res = await POST(makeRequest({ content: "merhaba" }), ctx);

    expect(res.status).toBe(201);
    expect(prismaMock.stepComment.create).toHaveBeenCalledOnce();
  });

  it("mentor + DRAFT roadmap → izin verilir (taslağı incelerken yorum yapabilir)", async () => {
    authAs(MENTOR_USER, "MENTOR");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("DRAFT"));
    prismaMock.stepComment.create.mockResolvedValue({ id: "c-2", content: "not" });

    const res = await POST(makeRequest({ content: "not" }), ctx);

    expect(res.status).toBe(201);
    expect(prismaMock.stepComment.create).toHaveBeenCalledOnce();
  });
});
