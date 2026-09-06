import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Bağımlılıkları mock'la ---
// vi.mock fabrikleri hoist edildiği için mock'ları vi.hoisted ile tanımlıyoruz.
const { requireAuthMock, prismaMock, saveStepFileMock, deleteStepFileMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmapStep: { findUnique: vi.fn() },
    stepFile: { count: vi.fn(), create: vi.fn() },
  },
  saveStepFileMock: vi.fn(),
  deleteStepFileMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/storage/step-files", () => ({
  saveStepFile: (...args: unknown[]) => saveStepFileMock(...args),
  deleteStepFile: (...args: unknown[]) => deleteStepFileMock(...args),
}));

import { POST } from "./route";

const STUDENT_USER = "student-1";
const MENTOR_USER = "mentor-1";

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

function authAs(userId: string, role: "STUDENT" | "MENTOR", accountStatus = "APPROVED") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: userId, role, accountStatus } },
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

describe("POST /api/steps/[stepId]/files — taslak (DRAFT) guard (#52/#69) & GRADUATED (#208)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.stepFile.count.mockResolvedValue(0);
  });

  it("GRADUATED öğrenci dosya yükleyemez → 403 (#208)", async () => {
    authAs(STUDENT_USER, "STUDENT", "GRADUATED");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("PUBLISHED"));

    const res = await POST(makeEmptyUploadRequest(), ctx);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Mezun öğrenciler");
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

describe("POST /api/steps/[stepId]/files — içerik imzası (#113)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.stepFile.count.mockResolvedValue(0);
  });

  function makeUploadRequest(fileName: string, content: Uint8Array | string) {
    const form = new FormData();
    form.set("file", new File([content as BlobPart], fileName));
    return new Request("http://test/api/steps/step-1/files", {
      method: "POST",
      body: form,
    });
  }

  it("png uzantılı ama png imzası taşımayan içerik 400 ile reddedilir", async () => {
    authAs(MENTOR_USER, "MENTOR");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("PUBLISHED"));

    const res = await POST(makeUploadRequest("evil.png", "bu bir metin, png degil"), ctx);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("uzantısıyla uyuşmuyor");
  });

  it("metin dosyasında (.txt) içerik kontrolü atlanır — imza hatası dönmez", async () => {
    authAs(MENTOR_USER, "MENTOR");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("PUBLISHED"));
    prismaMock.stepFile.create.mockResolvedValue({ id: "f-1" });

    const res = await POST(makeUploadRequest("notlar.txt", "serbest metin icerik"), ctx);

    // İmza kontrolüne takılmadı; başarılı oluşturuldu (201).
    expect(res.status).toBe(201);
  });
});

describe("POST /api/steps/[stepId]/files — orphan compensation (#201)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.stepFile.count.mockResolvedValue(0);
  });

  function makeUploadRequest(fileName: string, content: Uint8Array | string) {
    const form = new FormData();
    form.set("file", new File([content as BlobPart], fileName));
    return new Request("http://test/api/steps/step-1/files", {
      method: "POST",
      body: form,
    });
  }

  it("DB create hata verirse saveStepFile ile kaydedilen dosya deleteStepFile ile temizlenir", async () => {
    authAs(MENTOR_USER, "MENTOR");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(buildStep("PUBLISHED"));
    saveStepFileMock.mockResolvedValue(undefined);
    deleteStepFileMock.mockResolvedValue(undefined);
    prismaMock.stepFile.create.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(makeUploadRequest("test.txt", "dosya icerigi"), ctx);

    expect(res.status).toBe(500);
    expect(saveStepFileMock).toHaveBeenCalledOnce();
    expect(deleteStepFileMock).toHaveBeenCalledOnce();
  });
});

