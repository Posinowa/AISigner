import { describe, it, expect, beforeEach, vi } from "vitest";

// requireAuth + prisma mock; saveSurveyAnswers GERÇEK çalışır.
const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    studentProfile: { findUnique: vi.fn() },
    surveyQuestion: { findMany: vi.fn() },
    surveyAnswer: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

function authStudent() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "student-1", role: "STUDENT" } },
  });
}
function postReq(body: unknown) {
  return new Request("http://test/api/student/survey-answers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("student/survey-answers route (#45)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.surveyAnswer.upsert.mockReturnValue({});
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it("geçerli cevaplar → 201, transaction çağrılır", async () => {
    authStudent();
    prismaMock.studentProfile.findUnique.mockResolvedValue({ id: "sp-1" });
    prismaMock.surveyQuestion.findMany.mockResolvedValue([{ id: "q1" }, { id: "q2" }]);

    const res = await POST(
      postReq({ answers: [{ questionId: "q1", answer: "JS" }, { questionId: "q2", answer: "Backend" }] }),
    );

    expect(res.status).toBe(201);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("profil yoksa → 400 (SurveyValidationError)", async () => {
    authStudent();
    prismaMock.studentProfile.findUnique.mockResolvedValue(null);

    const res = await POST(postReq({ answers: [{ questionId: "q1", answer: "x" }] }));

    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("geçersiz/pasif soru ID'si → 400, transaction yok", async () => {
    authStudent();
    prismaMock.studentProfile.findUnique.mockResolvedValue({ id: "sp-1" });
    // q2 aktif sorularda yok
    prismaMock.surveyQuestion.findMany.mockResolvedValue([{ id: "q1" }]);

    const res = await POST(
      postReq({ answers: [{ questionId: "q1", answer: "a" }, { questionId: "q2", answer: "b" }] }),
    );

    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("boş answers → 400 (zod)", async () => {
    authStudent();
    const res = await POST(postReq({ answers: [] }));
    expect(res.status).toBe(400);
  });

  it("öğrenci değil → 403", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 403 }),
    });
    const res = await POST(postReq({ answers: [{ questionId: "q1", answer: "x" }] }));
    expect(res.status).toBe(403);
  });
});
