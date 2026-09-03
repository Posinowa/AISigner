// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Takılma radarı (#397).
 *
 * Kilitlenen kararlar:
 *  - Öğrenciye bildirim OPT-IN; mentör bildirimi bundan BAĞIMSIZ
 *  - GitHub'da çalışan öğrenci "takıldı" sayılmaz
 *  - GitHub verisi YOKSA mentöre açıkça söylenir ("veri yok" != "sinyal yok")
 *  - Adım başına BİR kez bildirim
 *  - Mezun stajyer kapsam dışı (#208)
 */

const { prismaMock, topluMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    roadmapStep: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
  },
  topluMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/features/bildirim/server/bildirim", () => ({
  topluBildirimGonder: topluMock,
  bildirimGonder: vi.fn(),
}));

import { takilanAdimlariBul, takilmalariBildir, radarTaramasi, TAKILMA_GUN } from "./radar";

const GUN = 86_400_000;
const eski = (gun: number) => new Date(Date.now() - gun * GUN);

const kullanici = (id = "o-1", durum = "APPROVED") => ({
  id,
  email: id + "@test.local",
  name: "Ali",
  lastName: "V",
  accountStatus: durum,
});

const ogrenciProfili = (over: Record<string, unknown> = {}) => ({
  takilmaBildirimi: false,
  user: kullanici(),
  mentorAssignments: [{ mentorId: "men-1" }],
  ...over,
});

const adim = (atamaOver: Record<string, unknown> = {}) => ({
  id: "st-1",
  title: "Docker kurulumu",
  updatedAt: eski(5),
  roadmap: {
    assignedProject: {
      sonCommitAt: null,
      githubRepoUrl: null,
      studentProfile: ogrenciProfili(),
      team: null,
      ...atamaOver,
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notification.findMany.mockResolvedValue([]);
  topluMock.mockResolvedValue(undefined);
});

describe("takılma tespiti", () => {
  it("uzun süredir ilerlemeyen adım yakalanır", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([adim()]);

    const sonuc = await takilanAdimlariBul();

    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].stepBaslik).toBe("Docker kurulumu");
    expect(sonuc[0].gecenGun).toBe(5);
  });

  it("sorgu YALNIZ yayımlanmış yol haritasındaki IN_PROGRESS adımlara bakar", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([]);

    await takilanAdimlariBul();

    const where = prismaMock.roadmapStep.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("IN_PROGRESS");
    expect(where.roadmap.status).toBe("PUBLISHED");
    expect(where.updatedAt.lt).toBeInstanceOf(Date);
  });

  it("GITHUB'DA CALISAN ogrenci takilmis SAYILMAZ", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([adim({ sonCommitAt: new Date() })]);

    expect(await takilanAdimlariBul()).toHaveLength(0);
  });

  it("eski commit takilmayi ENGELLEMEZ", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([
      adim({ sonCommitAt: eski(TAKILMA_GUN + 3) }),
    ]);

    const sonuc = await takilanAdimlariBul();
    expect(sonuc).toHaveLength(1);
    expect(sonuc[0].githubVerisiVar).toBe(true);
  });

  it("GitHub verisi YOKSA isaretlenir", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([adim({ sonCommitAt: null })]);

    expect((await takilanAdimlariBul())[0].githubVerisiVar).toBe(false);
  });

  it("MEZUN stajyer kapsam disi (#208)", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([
      adim({ studentProfile: ogrenciProfili({ user: kullanici("o-1", "GRADUATED") }) }),
    ]);

    expect(await takilanAdimlariBul()).toHaveLength(0);
  });

  it("mentoru olmayan ogrenci atlanir", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([
      adim({ studentProfile: ogrenciProfili({ mentorAssignments: [] }) }),
    ]);

    expect(await takilanAdimlariBul()).toHaveLength(0);
  });

  it("TAKIMDA tum aktif uyeler ve takim mentorleri toplanir", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([
      adim({
        studentProfile: null,
        team: {
          members: [
            { studentProfile: ogrenciProfili() },
            { studentProfile: ogrenciProfili({ user: kullanici("o-2") }) },
          ],
          mentors: [{ mentorId: "men-t" }],
        },
      }),
    ]);

    const sonuc = await takilanAdimlariBul();
    expect(sonuc[0].ogrenciler.map((o) => o.userId)).toEqual(["o-1", "o-2"]);
    expect(sonuc[0].mentorIdler).toEqual(["men-t"]);
  });
});

describe("bildirim", () => {
  const takilan = (over: Record<string, unknown> = {}) => ({
    stepId: "st-1",
    stepBaslik: "Docker",
    ogrenciler: [{ userId: "o-1", email: "e", ad: "Ali V", bildirimAcik: false }],
    gecenGun: 3,
    githubVerisiVar: true,
    mentorIdler: ["men-1"],
    ...over,
  });

  const girdiler = () => topluMock.mock.calls[0][0] as { userId: string; govde: string; refId: string }[];

  it("MENTORE her durumda bildirilir", async () => {
    await takilmalariBildir([takilan()]);
    expect(girdiler().map((g) => g.userId)).toEqual(["men-1"]);
  });

  it("OGRENCIYE opt-in KAPALIYKEN bildirilmez", async () => {
    await takilmalariBildir([takilan()]);
    expect(girdiler().some((g) => g.userId === "o-1")).toBe(false);
  });

  it("opt-in ACIKKEN ogrenciye de bildirilir", async () => {
    await takilmalariBildir([
      takilan({ ogrenciler: [{ userId: "o-1", email: "e", ad: "Ali", bildirimAcik: true }] }),
    ]);

    expect(girdiler().map((g) => g.userId)).toContain("o-1");
  });

  it("GitHub verisi yoksa mentor mesajinda ACIKCA yazar", async () => {
    await takilmalariBildir([takilan({ githubVerisiVar: false })]);
    expect(girdiler()[0].govde).toContain("GitHub verisi yok");
  });

  it("GitHub verisi varken o not YAZILMAZ", async () => {
    await takilmalariBildir([takilan()]);
    expect(girdiler()[0].govde).not.toContain("GitHub verisi yok");
  });

  it("AYNI ADIM icin IKINCI kez bildirilmez", async () => {
    prismaMock.notification.findMany.mockResolvedValue([{ userId: "men-1" }]);

    await takilmalariBildir([takilan()]);

    expect(topluMock).not.toHaveBeenCalled();
  });

  it("tekrar korumasi adim kimligiyle sorulur", async () => {
    await takilmalariBildir([takilan()]);

    const where = prismaMock.notification.findMany.mock.calls[0][0].where;
    expect(where.refId).toBe("st-1");
    expect(where.type).toBe("ADIM_TAKILDI");
  });

  it("bildirim refId tasir", async () => {
    await takilmalariBildir([takilan()]);
    expect(girdiler()[0].refId).toBe("st-1");
  });
});

describe("tarama", () => {
  it("takilma yoksa bildirim gonderilmez", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([]);

    expect(await radarTaramasi()).toBe(0);
    expect(topluMock).not.toHaveBeenCalled();
  });

  it("HATA YUTULUR - radar tetiklendigi akisi bozmamali", async () => {
    prismaMock.roadmapStep.findMany.mockRejectedValue(new Error("db down"));

    await expect(radarTaramasi()).resolves.toBe(0);
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});
