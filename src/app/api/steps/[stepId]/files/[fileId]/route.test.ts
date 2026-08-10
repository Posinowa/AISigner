import { describe, it, expect, beforeEach, vi } from "vitest";

// #197: fs yerine depolama katmanı (`@/lib/storage/step-files`) mock'lanır.
const { requireAuthMock, prismaMock, deleteStepFileMock, readStepFileMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { stepFile: { findUnique: vi.fn(), delete: vi.fn() } },
  deleteStepFileMock: vi.fn(),
  readStepFileMock: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/storage/step-files", () => ({
  deleteStepFile: (...a: unknown[]) => deleteStepFileMock(...a),
  readStepFile: (...a: unknown[]) => readStepFileMock(...a),
}));

import { DELETE, GET } from "./route";

function authAs(id: string, role: "MENTOR" | "STUDENT" = "STUDENT", accountStatus = "APPROVED") {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role, accountStatus } } });
}
const params = (stepId = "step-1", fileId = "f-1") => Promise.resolve({ stepId, fileId });

/** stepFile kaydı: yükleyen + öğrenci/mentör bilgisiyle. */
function stepFile(over: { uploaderId: string; ownerUserId: string; mentorId: string | null; stepId?: string }) {
  return {
    id: "f-1",
    stepId: over.stepId ?? "step-1",
    uploaderId: over.uploaderId,
    storedName: "abc.png",
    fileName: "abc.png",
    mimeType: "image/png",
    step: {
      roadmap: {
        assignedProject: {
          studentProfile: {
            userId: over.ownerUserId,
            // #195: M:N — mentorId varsa tek elemanlı atama listesi, yoksa boş.
            mentorAssignments: over.mentorId ? [{ mentorId: over.mentorId }] : [],
          },
        },
      },
    },
  };
}

describe("dosya sil/indir — yetki sınırları (#181) & GRADUATED (#208)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readStepFileMock.mockResolvedValue(null); // varsayılan: dosya yok
  });

  // ---- DELETE ----
  it("DELETE: GRADUATED öğrenci dosya silemez → 403 (#208)", async () => {
    authAs("student-1", "STUDENT", "GRADUATED");
    const res = await DELETE(new Request("http://t", { method: "DELETE" }), { params: params() });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Mezun öğrenciler");
    expect(prismaMock.stepFile.delete).not.toHaveBeenCalled();
  });

  it("DELETE: yükleyen siler", async () => {
    authAs("student-1");
    prismaMock.stepFile.findUnique.mockResolvedValue(
      stepFile({ uploaderId: "student-1", ownerUserId: "student-1", mentorId: "mentor-1" }),
    );

    const res = await DELETE(new Request("http://t", { method: "DELETE" }), { params: params() });

    expect(res.status).toBe(200);
    expect(prismaMock.stepFile.delete).toHaveBeenCalledWith({ where: { id: "f-1" } });
  });

  it("DELETE: öğrencinin mentörü siler (yüklemese de)", async () => {
    authAs("mentor-1", "MENTOR");
    prismaMock.stepFile.findUnique.mockResolvedValue(
      stepFile({ uploaderId: "student-1", ownerUserId: "student-1", mentorId: "mentor-1" }),
    );

    const res = await DELETE(new Request("http://t", { method: "DELETE" }), { params: params() });

    expect(res.status).toBe(200);
    expect(prismaMock.stepFile.delete).toHaveBeenCalled();
  });

  it("DELETE: ne yükleyen ne mentör → 403, silme YOK", async () => {
    authAs("baska-student");
    prismaMock.stepFile.findUnique.mockResolvedValue(
      stepFile({ uploaderId: "student-1", ownerUserId: "student-1", mentorId: "mentor-1" }),
    );

    const res = await DELETE(new Request("http://t", { method: "DELETE" }), { params: params() });

    expect(res.status).toBe(403);
    expect(prismaMock.stepFile.delete).not.toHaveBeenCalled();
    expect(deleteStepFileMock).not.toHaveBeenCalled();
  });

  it("DELETE: başka öğrenci mentör rolüyle gelse de (o öğrencinin mentörü değil) → 403", async () => {
    authAs("baska-mentor", "MENTOR");
    prismaMock.stepFile.findUnique.mockResolvedValue(
      stepFile({ uploaderId: "student-1", ownerUserId: "student-1", mentorId: "gercek-mentor" }),
    );

    const res = await DELETE(new Request("http://t", { method: "DELETE" }), { params: params() });

    expect(res.status).toBe(403);
    expect(prismaMock.stepFile.delete).not.toHaveBeenCalled();
  });

  it("DELETE: dosya bulunamazsa → 404", async () => {
    authAs("student-1");
    prismaMock.stepFile.findUnique.mockResolvedValue(null);

    const res = await DELETE(new Request("http://t", { method: "DELETE" }), { params: params() });

    expect(res.status).toBe(404);
  });

  it("DELETE: stepId uyuşmazlığı → 404", async () => {
    authAs("student-1");
    prismaMock.stepFile.findUnique.mockResolvedValue(
      stepFile({ uploaderId: "student-1", ownerUserId: "student-1", mentorId: "m", stepId: "baska-step" }),
    );

    const res = await DELETE(new Request("http://t", { method: "DELETE" }), { params: params() });

    expect(res.status).toBe(404);
    expect(prismaMock.stepFile.delete).not.toHaveBeenCalled();
  });

  // ---- GET (indir) erişim kontrolü ----
  it("GET: ne sahip ne mentör → 403", async () => {
    authAs("yabanci");
    prismaMock.stepFile.findUnique.mockResolvedValue(
      stepFile({ uploaderId: "student-1", ownerUserId: "student-1", mentorId: "mentor-1" }),
    );

    const res = await GET(new Request("http://t"), { params: params() });

    expect(res.status).toBe(403);
  });

  it("GET: sahip öğrenci → dosya servis edilir", async () => {
    authAs("student-1");
    prismaMock.stepFile.findUnique.mockResolvedValue(
      stepFile({ uploaderId: "student-1", ownerUserId: "student-1", mentorId: "mentor-1" }),
    );
    readStepFileMock.mockResolvedValue(Buffer.from("veri"));

    const res = await GET(new Request("http://t"), { params: params() });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("yetkisiz (guard) → 403, DB'ye gidilmez", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });

    const res = await DELETE(new Request("http://t", { method: "DELETE" }), { params: params() });

    expect(res.status).toBe(403);
    expect(prismaMock.stepFile.findUnique).not.toHaveBeenCalled();
  });
});
