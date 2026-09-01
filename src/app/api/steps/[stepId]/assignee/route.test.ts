// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #332 Faz 2 — adımı üstlenme ucu.
 *
 * EN KRİTİK İDDİA: adım yalnızca ATAMANIN ÖĞRENCİLERİNE atanabilir. Aksi
 * halde bir mentör ya da başka bir takımın üyesi panoya kendini yazabilirdi.
 *
 * İkinci iddia: başkasının üstlendiği adım DEVRALINABİLİR. Kilitlemek, sprint
 * panosundaki "havuzdan iş çekme" modelini bozardı.
 */

const { requireAuthMock, prismaMock, ustlenMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { roadmapStep: { findUnique: vi.fn() } },
  ustlenMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/teams/server/takim", () => ({ adimiUstlen: ustlenMock }));

import { PUT } from "./route";

const params = Promise.resolve({ stepId: "s1" });
const istek = (govde: unknown) =>
  new Request("http://t", { method: "PUT", body: JSON.stringify(govde) });

/** Takım ataması: iki aktif üye + bir takım mentörü. */
const takimAdimi = (roadmapStatus = "PUBLISHED") => ({
  id: "s1",
  roadmap: {
    status: roadmapStatus,
    assignedProject: {
      studentProfile: null,
      team: {
        id: "t1",
        name: "Takım A",
        members: [
          { role: "backend", studentProfile: { id: "sp1", userId: "ogr-1" } },
          { role: "frontend", studentProfile: { id: "sp2", userId: "ogr-2" } },
        ],
        mentors: [{ mentorId: "men-1" }],
      },
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "ogr-1", role: "STUDENT" } },
  });
  prismaMock.roadmapStep.findUnique.mockResolvedValue(takimAdimi());
  ustlenMock.mockResolvedValue({ ok: true, veri: undefined });
});

describe("yetki", () => {
  it("rol kapısı: yalnız MENTOR ve STUDENT", async () => {
    await PUT(istek({ assigneeId: "ogr-1" }), { params });
    expect(requireAuthMock).toHaveBeenCalledWith(["MENTOR", "STUDENT"]);
  });

  it("oturumsuzsa yazmaz", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    const res = await PUT(istek({ assigneeId: "ogr-1" }), { params });

    expect(res.status).toBe(401);
    expect(ustlenMock).not.toHaveBeenCalled();
  });

  it("ilgisiz kullanıcıya 404 — adımın varlığını sızdırmaz", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "yabanci", role: "STUDENT" } },
    });

    const res = await PUT(istek({ assigneeId: "ogr-1" }), { params });

    expect(res.status).toBe(404);
    expect(ustlenMock).not.toHaveBeenCalled();
  });

  it("takımın mentörü de üstlenme yazabilir", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "men-1", role: "MENTOR" } },
    });

    const res = await PUT(istek({ assigneeId: "ogr-2" }), { params });

    expect(res.status).toBe(200);
    expect(ustlenMock).toHaveBeenCalledWith({ stepId: "s1", userId: "ogr-2" });
  });
});

describe("hedef doğrulama", () => {
  it("ADIM YALNIZCA PROJENİN ÖĞRENCİSİNE atanabilir", async () => {
    // Mentörün ya da başka takımın üyesinin panoya yazılması engellenmeli.
    const res = await PUT(istek({ assigneeId: "men-1" }), { params });

    expect(res.status).toBe(400);
    expect(ustlenMock).not.toHaveBeenCalled();
  });

  it("başka bir takımın üyesi atanamaz", async () => {
    const res = await PUT(istek({ assigneeId: "baska-takim-uyesi" }), { params });

    expect(res.status).toBe(400);
    expect(ustlenMock).not.toHaveBeenCalled();
  });

  it("BAŞKASININ üstlendiği adım devralınabilir", async () => {
    // Havuzdan iş çekme modeli: kilitlemek Scrum'ı bozardı.
    const res = await PUT(istek({ assigneeId: "ogr-1" }), { params });

    expect(res.status).toBe(200);
    expect(ustlenMock).toHaveBeenCalledWith({ stepId: "s1", userId: "ogr-1" });
  });

  it("null ile bırakılabilir", async () => {
    const res = await PUT(istek({ assigneeId: null }), { params });

    expect(res.status).toBe(200);
    expect(ustlenMock).toHaveBeenCalledWith({ stepId: "s1", userId: null });
  });

  it("geçersiz gövde 400", async () => {
    const res = await PUT(istek({ assigneeId: 42 }), { params });

    expect(res.status).toBe(400);
    expect(ustlenMock).not.toHaveBeenCalled();
  });
});

describe("taslak yol haritası (#52 kuralı korunuyor)", () => {
  it("öğrenci DRAFT'ta üstlenemez", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(takimAdimi("DRAFT"));

    const res = await PUT(istek({ assigneeId: "ogr-1" }), { params });

    expect(res.status).toBe(403);
    expect(ustlenMock).not.toHaveBeenCalled();
  });

  it("mentör DRAFT'ta üstlenme yazabilir", async () => {
    // Mentör taslağı hazırlarken iş bölümü yapabilmeli.
    prismaMock.roadmapStep.findUnique.mockResolvedValue(takimAdimi("DRAFT"));
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "men-1", role: "MENTOR" } },
    });

    const res = await PUT(istek({ assigneeId: "ogr-1" }), { params });

    expect(res.status).toBe(200);
  });
});

describe("bireysel atama", () => {
  it("bireysel adımda sahip kendini üstlenebilir", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue({
      id: "s1",
      roadmap: {
        status: "PUBLISHED",
        assignedProject: {
          studentProfile: { id: "sp1", userId: "ogr-1", mentorAssignments: [] },
          team: null,
        },
      },
    });

    const res = await PUT(istek({ assigneeId: "ogr-1" }), { params });

    expect(res.status).toBe(200);
  });
});
