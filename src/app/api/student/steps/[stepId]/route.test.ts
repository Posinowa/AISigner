import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmapStep: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    assignedProject: { update: vi.fn() },
    // #324: durum degisikligi + gecmis kaydi tek transaction'da.
    stepStatusHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
// #324: Durum degisikligi artik gecmis kaydiyla birlikte yapiliyor.
// `server-only` bu depoda test ortaminda mock'lanir (yerlesik desen).
vi.mock("server-only", () => ({}));

import { PATCH } from "./route";

function student(id: string, accountStatus = "APPROVED") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id, role: "STUDENT", accountStatus } },
  });
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
    // #324: transaction, [guncellenmis adim, gecmis kaydi] doner.
    prismaMock.$transaction.mockResolvedValue([{ id: "s-1", status: "IN_PROGRESS" }, {}]);
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

  // #324 REGRESYON: durum degisikligi GECMISE de yazilmali. Dogrudan
  // `prisma.roadmapStep.update` cagirmak gecmisi sessizce atlar ve analitik
  // verisi kalici olarak eksilir — bugun kaydedilmeyen gecis geri gelmez.
  it("durum degisikligi GECMISE kaydedilir (kim, nereden, nereye)", async () => {
    student("student-1");
    prismaMock.roadmapStep.findUnique.mockResolvedValue(stepGraph({ ownerUserId: "student-1" }));

    await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });

    expect(prismaMock.stepStatusHistory.create).toHaveBeenCalledWith({
      data: {
        stepId: "s-1",
        fromStatus: "TODO",
        toStatus: "IN_PROGRESS",
        // #379: Gerekçe alanı — öğrenci geçişlerinde boş.
        note: null,
        changedById: "student-1",
      },
    });
    // Ikisi tek transaction'da: biri yazilip digeri yazilmamali.
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
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

  it("GRADUATED öğrenci adım durumunu değiştiremez → 403 (#208)", async () => {
    student("student-1", "GRADUATED");
    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Mezun öğrenciler");
    expect(prismaMock.roadmapStep.findUnique).not.toHaveBeenCalled();
  });
});

/**
 * #379 — REVİZYON İSTENEN ADIM.
 *
 * Mentör "eksik, revize et" dediğinde adım KİLİTLENMEMELİ: öğrenci yeniden
 * başlatıp düzeltebilmeli. Ama doğrudan COMPLETED'a atlamak kapalı —
 * TODO'daki kuralın aynısı, geçmiş (#324) "yeniden çalıştı" adımını göstersin.
 */
describe("revizyon istenen adım (#379)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "student-1", role: "STUDENT" } },
    });
    prismaMock.roadmapStep.findMany.mockResolvedValue([]);
    prismaMock.assignedProject.update.mockResolvedValue({});
    prismaMock.$transaction.mockResolvedValue([{ id: "s-1", status: "IN_PROGRESS" }, {}]);
  });

  it("yeniden BAŞLATILABİLİR", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      stepGraph({ ownerUserId: "student-1", targetStatus: "REVISION_REQUESTED" }),
    );

    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });

    expect(res.status).toBe(200);
  });

  it("DOĞRUDAN tamamlanamaz", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      stepGraph({ ownerUserId: "student-1", targetStatus: "REVISION_REQUESTED" }),
    );

    const res = await PATCH(req({ status: "COMPLETED" }), { params: params() });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("yeniden başlatın");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("TAMAMLANMIŞ adım hâlâ değiştirilemez — revizyon yolu mentörden geçer", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      stepGraph({ ownerUserId: "student-1", targetStatus: "COMPLETED" }),
    );

    const res = await PATCH(req({ status: "IN_PROGRESS" }), { params: params() });
    expect(res.status).toBe(400);
  });
});
