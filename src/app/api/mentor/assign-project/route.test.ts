import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";

// requireAuth + prisma mock; assignProjectToStudent GERÇEK çalışır (uçtan uca 201/409).
const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    studentProfile: { findFirst: vi.fn() },
    assignedProject: { findFirst: vi.fn(), create: vi.fn() },
    // #503: Atama öncesi şablonun `tekrarlanabilir` bayrağı okunuyor.
    projectTemplate: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

/** #503: Varsayılan tekrarlanamaz — #58 korumasının test ettiği durum. */
function sablonTekrarlanamaz() {
  prismaMock.projectTemplate.findUnique.mockResolvedValue({ tekrarlanabilir: false });
}

function authAsMentor() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "mentor-1", role: "MENTOR" } },
  });
}

function postReq(body: unknown) {
  return new Request("http://test/api/mentor/assign-project", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = { studentProfileId: "sp-1", projectTemplateId: "pt-1" };

describe("POST /api/mentor/assign-project — duplicate koruması (#58)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sablonTekrarlanamaz();
    // Öğrenci bu mentor'a ait (ownership geçer)
    prismaMock.studentProfile.findFirst.mockResolvedValue({ id: "sp-1", mentorId: "mentor-1" });
  });

  it("normal atama → 201, create çağrılır", async () => {
    authAsMentor();
    prismaMock.assignedProject.findFirst.mockResolvedValue(null);
    prismaMock.assignedProject.create.mockResolvedValue({ id: "ap-1" });

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(201);
    expect(prismaMock.assignedProject.create).toHaveBeenCalledOnce();
  });

  it("uygulama ön-kontrolü: zaten atanmış → 409, create yok", async () => {
    authAsMentor();
    prismaMock.assignedProject.findFirst.mockResolvedValue({ id: "ap-existing" });

    const res = await POST(postReq(validBody));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(typeof json.error).toBe("string");
    expect(prismaMock.assignedProject.create).not.toHaveBeenCalled();
  });

  it("yarış koşulu: ön-kontrol geçer ama create P2002 atar → 409", async () => {
    authAsMentor();
    prismaMock.assignedProject.findFirst.mockResolvedValue(null);
    prismaMock.assignedProject.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.x",
      }),
    );

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(409);
  });

  it("mentor değilse requireAuth yanıtını döner (403)", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 403 }),
    });

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(403);
  });

  it("eksik alan → 400 (zod validation)", async () => {
    authAsMentor();
    const res = await POST(postReq({ studentProfileId: "sp-1" }));
    expect(res.status).toBe(400);
  });

  it("beklenmedik DB hatası → 500", async () => {
    authAsMentor();
    prismaMock.assignedProject.findFirst.mockResolvedValue(null);
    prismaMock.assignedProject.create.mockRejectedValue(new Error("db patladı"));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(500);
  });

  /**
   * #503 — TEKRARLANABİLİR ŞABLON.
   *
   * Portfolyo sitesi gibi herkesin yapması beklenen işler ve araştırma
   * ödevleri aynı stajyere birden çok kez atanabilmeli. #58'in koruması
   * yalnız bu bayrak açıkken gevşiyor.
   */
  it("⚠️ #503: tekrarlanabilir şablonda ZATEN ATANMIŞ olsa da 201", async () => {
    authAsMentor();
    prismaMock.projectTemplate.findUnique.mockResolvedValue({ tekrarlanabilir: true });
    // Ön kontrol bir kayıt bulsa BİLE atama geçmeli.
    prismaMock.assignedProject.findFirst.mockResolvedValue({ id: "zaten-var" });
    prismaMock.assignedProject.create.mockResolvedValue({ id: "ap-2" });

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(201);
    expect(prismaMock.assignedProject.create).toHaveBeenCalled();
  });

  it("⚠️ #503: tekrarlanabilir şablonda tekilKey NULL yazılır", async () => {
    authAsMentor();
    prismaMock.projectTemplate.findUnique.mockResolvedValue({ tekrarlanabilir: true });
    prismaMock.assignedProject.findFirst.mockResolvedValue(null);
    prismaMock.assignedProject.create.mockResolvedValue({ id: "ap-2" });

    await POST(postReq(validBody));

    expect(prismaMock.assignedProject.create.mock.calls[0][0].data.tekilKey).toBeNull();
  });

  it("⚠️ #503: tekrarlanamaz şablonda tekilKey DOLU — #58 koruması sürer", async () => {
    authAsMentor();
    prismaMock.assignedProject.findFirst.mockResolvedValue(null);
    prismaMock.assignedProject.create.mockResolvedValue({ id: "ap-1" });

    await POST(postReq(validBody));

    expect(prismaMock.assignedProject.create.mock.calls[0][0].data.tekilKey).toBe(
      "sp:sp-1:pt-1",
    );
  });

  it("⚠️ #503: şablon yoksa 409 — var olmayan şablona atama yapılmaz", async () => {
    authAsMentor();
    prismaMock.projectTemplate.findUnique.mockResolvedValue(null);

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(409);
    expect(prismaMock.assignedProject.create).not.toHaveBeenCalled();
  });
});
