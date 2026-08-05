import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmap: { findUnique: vi.fn() },
    roadmapStep: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

function authMentor() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "mentor-1", role: "MENTOR" } },
  });
}
function postReq(body: unknown) {
  return new Request("http://test/api/mentor/roadmap/rm-1/steps", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ roadmapId: "rm-1" }) };
const validBody = { title: "Adım", description: "Açıklama" };

describe("POST /api/mentor/roadmap/[roadmapId]/steps — githubIssueUrl (#50)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.roadmap.findUnique.mockResolvedValue({
      id: "rm-1",
      assignedProject: { studentProfile: { mentorAssignments: [{ mentorId: "mentor-1" }] } },
    });
    prismaMock.roadmapStep.findFirst.mockResolvedValue(null);
    prismaMock.roadmapStep.create.mockResolvedValue({ id: "step-1" });
  });

  it("geçerli github.com issue URL'i ile 201 döner", async () => {
    authMentor();

    const res = await POST(
      postReq({ ...validBody, githubIssueUrl: "https://github.com/kullanici/repo/issues/12" }),
      ctx,
    );

    expect(res.status).toBe(201);
    const arg = prismaMock.roadmapStep.create.mock.calls[0][0];
    expect(arg.data.githubIssueUrl).toBe("https://github.com/kullanici/repo/issues/12");
  });

  it("geçersiz URL ile 400 döner, create çağrılmaz", async () => {
    authMentor();

    const res = await POST(postReq({ ...validBody, githubIssueUrl: "not-a-url" }), ctx);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.githubIssueUrl).toBeTruthy();
    expect(prismaMock.roadmapStep.create).not.toHaveBeenCalled();
  });

  it("githubIssueUrl belirtilmeden 201 döner (opsiyonel)", async () => {
    authMentor();

    const res = await POST(postReq(validBody), ctx);

    expect(res.status).toBe(201);
  });

  it("başka mentor'un roadmap'ine adım eklemeye çalışırsa 403", async () => {
    authMentor();
    prismaMock.roadmap.findUnique.mockResolvedValue({
      id: "rm-1",
      assignedProject: { studentProfile: { mentorAssignments: [{ mentorId: "baska-mentor" }] } },
    });

    const res = await POST(postReq(validBody), ctx);
    expect(res.status).toBe(403);
  });
});
