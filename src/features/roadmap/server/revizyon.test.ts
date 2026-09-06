// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Mentör onay kapısı — revizyon isteği (#379).
 *
 * Kilitlenen kararlar:
 *  - YALNIZCA tamamlanmış adım revize edilebilir
 *  - Gerekçe ZORUNLU (#366 deseni) ve geçmişe yazılır (#324)
 *  - Yetki: atanmış mentör (bireysel VEYA takım, #370) + admin
 *  - Mezun stajyerde kapalı (#208)
 *  - Proje "tamamlandı" olarak kalmaz
 */

const { prismaMock, degistirMock } = vi.hoisted(() => ({
  prismaMock: {
    roadmapStep: { findUnique: vi.fn(), findFirst: vi.fn() },
    assignedProject: { update: vi.fn() },
    stepStatusHistory: { findFirst: vi.fn() },
  },
  degistirMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("./step-status", () => ({ adimDurumunuDegistir: degistirMock }));

import { revizyonIste, guncelRevizyonGerekcesi, REVIZYON_DURUMU } from "./revizyon";

const adim = (ekle: Record<string, unknown> = {}) => ({
  id: "st-1",
  status: "COMPLETED",
  githubIssueUrl: null,
  roadmap: {
    assignedProject: {
      id: "ap-1",
      status: "IN_PROGRESS",
      githubRepoUrl: null,
      studentProfile: { user: { accountStatus: "APPROVED" } },
      team: null,
      ...(ekle.atama as object ?? {}),
    },
  },
  ...ekle,
});

const iste = (ekle: Record<string, unknown> = {}) =>
  revizyonIste({
    stepId: "st-1",
    isteyenUserId: "men-1",
    isteyenRol: "MENTOR",
    gerekce: "Testler eksik, lütfen kapsamı genişlet.",
    ...ekle,
  });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.roadmapStep.findUnique.mockResolvedValue(adim());
  prismaMock.roadmapStep.findFirst.mockResolvedValue({ id: "st-1" });
  prismaMock.assignedProject.update.mockResolvedValue({});
  degistirMock.mockResolvedValue({});
});

describe("ön koşullar", () => {
  it("olmayan adım → adim-yok", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(null);
    expect(await iste()).toEqual({ ok: false, neden: "adim-yok" });
  });

  it("TAMAMLANMAMIŞ adım revize edilemez", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(adim({ status: "IN_PROGRESS" }));
    expect(await iste()).toEqual({ ok: false, neden: "tamamlanmamis" });
    expect(degistirMock).not.toHaveBeenCalled();
  });

  it("GEREKÇE ZORUNLU — boşluk da geçmez", async () => {
    expect(await iste({ gerekce: "   " })).toEqual({ ok: false, neden: "gerekce-gerekli" });
    expect(degistirMock).not.toHaveBeenCalled();
  });

  it("MEZUN stajyerin adımı revize edilemez (#208)", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      adim({ atama: { studentProfile: { user: { accountStatus: "GRADUATED" } } } }),
    );
    expect(await iste()).toEqual({ ok: false, neden: "mezun" });
  });

  it("takımda ÜYELERDEN BİRİ aktifse revize edilebilir", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(
      adim({
        atama: {
          studentProfile: null,
          team: {
            members: [
              { studentProfile: { user: { accountStatus: "GRADUATED" } } },
              { studentProfile: { user: { accountStatus: "APPROVED" } } },
            ],
          },
        },
      }),
    );
    expect((await iste()).ok).toBe(true);
  });
});

describe("yetki", () => {
  it("BAŞKASININ öğrencisinde yetki-yok", async () => {
    prismaMock.roadmapStep.findFirst.mockResolvedValue(null);
    expect(await iste()).toEqual({ ok: false, neden: "yetki-yok" });
    expect(degistirMock).not.toHaveBeenCalled();
  });

  it("sahiplik BİREYSEL ve TAKIM bağını birlikte sorar (#370)", async () => {
    await iste();
    const where = prismaMock.roadmapStep.findFirst.mock.calls[0][0].where;
    const [bireysel, takim] = where.roadmap.assignedProject.OR;
    expect(bireysel.studentProfile.OR[0].mentorAssignments.some.mentorId).toBe("men-1");
    expect(takim.team.mentors.some.mentorId).toBe("men-1");
  });

  it("ADMIN sahiplik sorgusu ÇALIŞTIRMAZ — her adıma erişir", async () => {
    await iste({ isteyenRol: "ADMIN", isteyenUserId: "admin-1" });
    expect(prismaMock.roadmapStep.findFirst).not.toHaveBeenCalled();
  });
});

describe("yazma", () => {
  it("durumu REVISION_REQUESTED yapar ve gerekçeyi GEÇMİŞE yazar", async () => {
    await iste();
    expect(degistirMock).toHaveBeenCalledWith({
      stepId: "st-1",
      yeniDurum: REVIZYON_DURUMU,
      oncekiDurum: "COMPLETED",
      degistirenId: "men-1",
      not: "Testler eksik, lütfen kapsamı genişlet.",
    });
  });

  it("TAMAMLANMIŞ proje IN_PROGRESS'e döner — panoda 'tamamlandı' kalmasın", async () => {
    prismaMock.roadmapStep.findUnique.mockResolvedValue(adim({ atama: { status: "COMPLETED" } }));
    await iste();
    expect(prismaMock.assignedProject.update).toHaveBeenCalledWith({
      where: { id: "ap-1" },
      data: { status: "IN_PROGRESS" },
    });
  });

  it("zaten IN_PROGRESS olan projeye DOKUNMAZ", async () => {
    await iste();
    expect(prismaMock.assignedProject.update).not.toHaveBeenCalled();
  });
});

describe("guncelRevizyonGerekcesi", () => {
  it("EN SON revizyon gerekçesini döner — adım birden çok kez revize edilebilir", async () => {
    prismaMock.stepStatusHistory.findFirst.mockResolvedValue({ note: "ikinci gerekçe" });

    expect(await guncelRevizyonGerekcesi("st-1")).toBe("ikinci gerekçe");
    const cagri = prismaMock.stepStatusHistory.findFirst.mock.calls[0][0];
    expect(cagri.where.toStatus).toBe(REVIZYON_DURUMU);
    expect(cagri.orderBy.createdAt).toBe("desc");
  });

  it("gerekçe yoksa null", async () => {
    prismaMock.stepStatusHistory.findFirst.mockResolvedValue(null);
    expect(await guncelRevizyonGerekcesi("st-1")).toBeNull();
  });
});
