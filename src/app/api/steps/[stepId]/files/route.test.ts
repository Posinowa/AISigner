import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Bağımlılıkları mock'la ---
// vi.mock fabrikleri hoist edildiği için mock'ları vi.hoisted ile tanımlıyoruz.
const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmapStep: { findUnique: vi.fn() },
    stepFile: { count: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

const STUDENT_USER = "student-1";
const MENTOR_USER = "mentor-1";

function buildStep(status: "DRAFT" | "PUBLISHED") {
  return {
    id: "step-1",
    roadmap: {
      status,
      assignedProject: {
        studentProfile: { userId: STUDENT_USER, mentorId: MENTOR_USER },
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

/** Dosya içermeyen multipart istek — 403 guard'ı geçerse "Dosya seçilmedi" (400) döner. */
function makeEmptyUploadRequest() {
  return new Request("http://test/api/steps/step-1/files", {
    method: "POST",
    body: new FormData(),
  });
}

const ctx = { params: Promise.resolve({ stepId: "step-1" }) };

describe("POST /api/steps/[stepId]/files — taslak (DRAFT) guard (#52/#69)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.stepFile.count.mockResolvedValue(0);
  });

  it("öğrenci + DRAFT roadmap → 403 (dosya sayımına bile gitmeden reddeder)", async () => {
    authAs(STUDENT_USER, "STUDENT");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("DRAFT"));

    const res = await POST(makeEmptyUploadRequest(), ctx);

    expect(res.status).toBe(403);
    expect(prismaMock.stepFile.count).not.toHaveBeenCalled();
  });

  it("öğrenci + PUBLISHED roadmap → 403 guard'ını geçer (boş dosya nedeniyle 400)", async () => {
    authAs(STUDENT_USER, "STUDENT");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("PUBLISHED"));

    const res = await POST(makeEmptyUploadRequest(), ctx);

    // 403 değil → draft guard'ını geçti; dosya gönderilmediği için 400.
    expect(res.status).toBe(400);
    expect(prismaMock.stepFile.count).toHaveBeenCalledOnce();
  });

  it("mentor + DRAFT roadmap → 403 guard'ını geçer (taslağa yükleyebilir)", async () => {
    authAs(MENTOR_USER, "MENTOR");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("DRAFT"));

    const res = await POST(makeEmptyUploadRequest(), ctx);

    expect(res.status).not.toBe(403);
    expect(prismaMock.stepFile.count).toHaveBeenCalledOnce();
  });
});
