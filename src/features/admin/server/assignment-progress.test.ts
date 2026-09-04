import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, ozetMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { assignedProject: { findMany: vi.fn() } },
  ozetMock: vi.fn(),
}));
vi.mock("./adim-ozeti", async (asilModul) => ({
  ...(await asilModul<typeof import("./adim-ozeti")>()),
  adimOzetleriniGetir: (...a: unknown[]) => ozetMock(...a),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getStudentAssignmentsProgress, MENTORSUZ, SAYFA_BOYUTU } from "./assignment-progress";

/** Sayfa boyutundan bir fazla satır — "daha var mı" hilesini tetikler. */
const satirlar = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `ap${i}`,
    status: "IN_PROGRESS",
    githubStatus: "PROVISIONED",
    githubRepoUrl: null,
    provisionedAt: null,
    createdAt: new Date(),
    team: null,
    studentProfile: null,
    projectTemplate: { id: "t1", title: "Proje", difficulty: "EASY" },
    roadmap: null,
  }));

function admin() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "a", role: "ADMIN" } },
  });
}

describe("getStudentAssignmentsProgress — yetki (#178-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.assignedProject.findMany.mockResolvedValue([]);
    ozetMock.mockResolvedValue(new Map());
  });

  it("ADMIN rolü guard'a geçirilir", async () => {
    requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "a", role: "ADMIN" } } });

    await getStudentAssignmentsProgress();

    expect(requireAuthMock).toHaveBeenCalledWith(["ADMIN"]);
  });

  it("yetkisizse hata fırlatır ve DB'ye HİÇ gidilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    await expect(getStudentAssignmentsProgress()).rejects.toThrow();
    expect(prismaMock.assignedProject.findMany).not.toHaveBeenCalled();
  });

  it("yetkiliyse sayfalı şekli döndürür", async () => {
    admin();

    const res = await getStudentAssignmentsProgress();

    expect(Array.isArray(res.atamalar)).toBe(true);
    expect(res.nextCursor).toBeNull();
    expect(res.sayaclar).toEqual({ toplam: 0, kurulu: 0, kurulmamis: 0, ortalamaIlerleme: 0 });
    expect(prismaMock.assignedProject.findMany).toHaveBeenCalled();
  });
});

/**
 * #452 — Sayfalama ve süzme.
 *
 * ⚠️ Bu sözleşmeyi ne tip sistemi ne de eski testler koruyordu: rota
 * `NextResponse.json(data)` dediği ve sayfa `res.json()`'u tipsiz aldığı için
 * dönüş şekli diziden nesneye geçtiğinde hiçbir şey uyarmadı. Şekil burada
 * kilitleniyor.
 */
describe("getStudentAssignmentsProgress — sayfalama (#452)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ozetMock.mockResolvedValue(new Map());
  });

  it("`limit + 1` çeker — 'daha var mı' fazladan sorgu istemesin", async () => {
    admin();
    prismaMock.assignedProject.findMany.mockResolvedValue([]);

    await getStudentAssignmentsProgress({ limit: 10 });

    expect(prismaMock.assignedProject.findMany.mock.calls[0][0].take).toBe(11);
  });

  it("fazladan satır LİSTEYE GİRMEZ, imleç olarak döner", async () => {
    admin();
    // Liste sorgusu limit+1 döner; sayaç sorgusu ayrı çağrı.
    prismaMock.assignedProject.findMany
      .mockResolvedValueOnce(satirlar(4))
      .mockResolvedValue([]);

    const res = await getStudentAssignmentsProgress({ limit: 3 });

    expect(res.atamalar).toHaveLength(3);
    expect(res.nextCursor).toBe("ap2");
  });

  it("liste bittiğinde imleç null", async () => {
    admin();
    prismaMock.assignedProject.findMany
      .mockResolvedValueOnce(satirlar(2))
      .mockResolvedValue([]);

    const res = await getStudentAssignmentsProgress({ limit: 3 });

    expect(res.atamalar).toHaveLength(2);
    expect(res.nextCursor).toBeNull();
  });

  it("⚠️ SIRALAMA İKİ ALANLI — tek alanlı sıra imleçte satır atlatır/tekrarlar", async () => {
    admin();
    prismaMock.assignedProject.findMany.mockResolvedValue([]);

    await getStudentAssignmentsProgress();

    expect(prismaMock.assignedProject.findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: "desc" },
      { id: "desc" },
    ]);
  });

  it("varsayılan sayfa boyutu uygulanır", async () => {
    admin();
    prismaMock.assignedProject.findMany.mockResolvedValue([]);

    await getStudentAssignmentsProgress();

    expect(prismaMock.assignedProject.findMany.mock.calls[0][0].take).toBe(SAYFA_BOYUTU + 1);
  });

  it("limit üst sınırla kırpılır — istemci tüm tabloyu tek istekte çekemesin", async () => {
    admin();
    prismaMock.assignedProject.findMany.mockResolvedValue([]);

    await getStudentAssignmentsProgress({ limit: 99999 });

    expect(prismaMock.assignedProject.findMany.mock.calls[0][0].take).toBe(201);
  });

  it("imleç verilince `skip: 1` ile o kayıttan SONRASI gelir", async () => {
    admin();
    prismaMock.assignedProject.findMany.mockResolvedValue([]);

    await getStudentAssignmentsProgress({ cursor: "ap9" });

    const arg = prismaMock.assignedProject.findMany.mock.calls[0][0];
    expect(arg.cursor).toEqual({ id: "ap9" });
    expect(arg.skip).toBe(1);
  });
});

describe("getStudentAssignmentsProgress — süzme (#452)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ozetMock.mockResolvedValue(new Map());
    prismaMock.assignedProject.findMany.mockResolvedValue([]);
  });

  const listeKosulu = () => prismaMock.assignedProject.findMany.mock.calls[0][0].where;
  const sayacKosulu = () => prismaMock.assignedProject.findMany.mock.calls[1][0].where;

  it("PROVISIONED süzgeci listeye uygulanır", async () => {
    admin();
    await getStudentAssignmentsProgress({ githubDurum: "PROVISIONED" });
    expect(JSON.stringify(listeKosulu())).toContain("PROVISIONED");
  });

  it("⚠️ SAYAÇLAR DURUM SÜZGECİNİ ALMAZ — üç sekme sayısını aynı anda gösteriyor", async () => {
    admin();
    await getStudentAssignmentsProgress({ githubDurum: "PROVISIONED" });
    // Sayaç sorgusunda githubStatus koşulu OLMAMALI; yoksa "Repo Bekleyenler"
    // sekmesine geçen admin diğer iki sekmeyi sıfır görürdü.
    expect(JSON.stringify(sayacKosulu())).not.toContain("githubStatus");
  });

  it("mentör süzgeci SAYAÇLARA DA uygulanır — kapsam daraldıysa sayı da daralmalı", async () => {
    admin();
    await getStudentAssignmentsProgress({ mentorId: "m1" });
    expect(JSON.stringify(sayacKosulu())).toContain("m1");
  });

  it("⚠️ mentör bağı İKİ YOLDAN sorulur — takım mentörlüğü düşmesin (#370)", async () => {
    admin();
    await getStudentAssignmentsProgress({ mentorId: "m1" });
    const k = JSON.stringify(listeKosulu());
    expect(k).toContain("mentorAssignments");
    expect(k).toContain("team");
  });

  it("MENTORSUZ ayrı bir seçenek — mentörsüz atamalar gizlenmemeli", async () => {
    admin();
    await getStudentAssignmentsProgress({ mentorId: MENTORSUZ });
    expect(JSON.stringify(listeKosulu())).toContain("none");
  });
});
