// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #332 Faz 2 — takım yaşam döngüsü.
 *
 * Kilitlenen kurallar:
 *   1. ÜYELİK SATIRI SİLİNMEZ — `leftAt` işaretlenir. Ayrılan üyenin katkı
 *      geçmişi bireysel sertifikasının dayanağı.
 *   2. Ayrılan üyenin ÜSTLENDİĞİ adımlar panoya geri düşer (sahipsiz kalmaz).
 *   3. Takım büyüklüğü sınırı ve "en az 2 üye" şartı.
 *   4. Takım ataması `studentProfileId` YAZMAZ — CHECK kısıtı sahibin tam biri
 *      olmasını şart koşuyor.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    team: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    teamMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    teamMentor: { deleteMany: vi.fn(), createMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    projectTemplate: { findUnique: vi.fn() },
    assignedProject: { create: vi.fn() },
    roadmapStep: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  uyeEkle,
  uyeAyir,
  mentorleriAyarla,
  takimaProjeAta,
  adimiUstlen,
  AZAMI_UYE,
  ASGARI_UYE,
} from "./takim";

const uyeler = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}` }));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.team.findUnique.mockResolvedValue({ id: "t1", members: uyeler(1) });
  prismaMock.user.findUnique.mockResolvedValue({
    role: "STUDENT",
    studentProfile: { id: "sp1" },
  });
  prismaMock.teamMember.findUnique.mockResolvedValue(null);
  prismaMock.teamMember.create.mockResolvedValue({});
  prismaMock.teamMember.update.mockResolvedValue({});
  prismaMock.teamMember.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.roadmapStep.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.projectTemplate.findUnique.mockResolvedValue({ id: "pt1" });
  prismaMock.assignedProject.create.mockResolvedValue({ id: "ap1" });
  prismaMock.$transaction.mockResolvedValue([]);
});

describe("uyeEkle", () => {
  it("stajyeri takıma ekler", async () => {
    const s = await uyeEkle({ teamId: "t1", studentUserId: "u1", role: "backend" });

    expect(s.ok).toBe(true);
    expect(prismaMock.teamMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { teamId: "t1", studentProfileId: "sp1", role: "backend" },
      }),
    );
  });

  it("MENTÖR takıma üye YAPILAMAZ", async () => {
    // Takım stajyer takımı; mentör takıma `TeamMentor` ile bağlanır.
    prismaMock.user.findUnique.mockResolvedValue({ role: "MENTOR", studentProfile: null });

    expect(await uyeEkle({ teamId: "t1", studentUserId: "m1", role: "qa" })).toEqual({
      ok: false,
      neden: "ogrenci-degil",
    });
    expect(prismaMock.teamMember.create).not.toHaveBeenCalled();
  });

  it("profili olmayan stajyer eklenemez", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT", studentProfile: null });

    expect((await uyeEkle({ teamId: "t1", studentUserId: "u1", role: "qa" })).ok).toBe(false);
  });

  it("takım doluyken eklenemez", async () => {
    prismaMock.team.findUnique.mockResolvedValue({ id: "t1", members: uyeler(AZAMI_UYE) });

    expect(await uyeEkle({ teamId: "t1", studentUserId: "u1", role: "qa" })).toEqual({
      ok: false,
      neden: "takim-dolu",
    });
  });

  it("zaten aktif üye ikinci kez eklenemez", async () => {
    prismaMock.teamMember.findUnique.mockResolvedValue({ id: "tm1", leftAt: null });

    expect(await uyeEkle({ teamId: "t1", studentUserId: "u1", role: "qa" })).toEqual({
      ok: false,
      neden: "zaten-uye",
    });
  });

  it("AYRILMIŞ üye geri alınır — yeni satır AÇILMAZ", async () => {
    // Yeni satır açmak `@@unique([teamId, studentProfileId])` ile çakışırdı ve
    // aynı kişinin iki üyelik kaydı olurdu.
    prismaMock.teamMember.findUnique.mockResolvedValue({ id: "tm1", leftAt: new Date() });

    const s = await uyeEkle({ teamId: "t1", studentUserId: "u1", role: "design" });

    expect(s.ok).toBe(true);
    expect(prismaMock.teamMember.create).not.toHaveBeenCalled();
    expect(prismaMock.teamMember.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tm1" },
        data: expect.objectContaining({ leftAt: null, role: "design" }),
      }),
    );
  });
});

describe("uyeAyir", () => {
  beforeEach(() => {
    prismaMock.teamMember.findUnique.mockResolvedValue({
      studentProfile: { userId: "u1" },
    });
  });

  it("satırı SİLMEZ, leftAt işaretler", async () => {
    // Katkı geçmişi bireysel sertifikanın dayanağı; satır silinemez.
    const s = await uyeAyir({ teamId: "t1", memberId: "tm1" });

    expect(s.ok).toBe(true);
    expect(prismaMock.teamMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tm1", teamId: "t1", leftAt: null },
        data: { leftAt: expect.any(Date) },
      }),
    );
  });

  it("ayrılan üyenin ÜSTLENDİĞİ adımlar panoya geri düşer", async () => {
    await uyeAyir({ teamId: "t1", memberId: "tm1" });

    expect(prismaMock.roadmapStep.updateMany).toHaveBeenCalledWith({
      where: {
        assigneeId: "u1",
        roadmap: { assignedProject: { teamId: "t1" } },
      },
      data: { assigneeId: null },
    });
  });

  it("zaten ayrılmış üye için 'uye-degil'", async () => {
    // `leftAt: null` koşulu tutmazsa count 0 döner — çift ayırma yok.
    prismaMock.teamMember.updateMany.mockResolvedValue({ count: 0 });

    expect(await uyeAyir({ teamId: "t1", memberId: "tm1" })).toEqual({
      ok: false,
      neden: "uye-degil",
    });
    expect(prismaMock.roadmapStep.updateMany).not.toHaveBeenCalled();
  });
});

describe("mentorleriAyarla", () => {
  it("MENTOR olmayan kimlik reddedilir", async () => {
    prismaMock.team.findUnique.mockResolvedValue({ id: "t1" });
    // İki kimlik istendi, biri MENTOR değil.
    prismaMock.user.findMany.mockResolvedValue([{ id: "men-1" }]);

    expect(await mentorleriAyarla({ teamId: "t1", mentorIds: ["men-1", "ogr-1"] })).toEqual({
      ok: false,
      neden: "mentor-degil",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("tam kümeyi TEK işlemde yazar", async () => {
    // Sil+yaz ayrı çalışsaydı arada mentörsüz bir an oluşurdu.
    prismaMock.team.findUnique.mockResolvedValue({ id: "t1" });
    prismaMock.user.findMany.mockResolvedValue([{ id: "men-1" }, { id: "men-2" }]);

    const s = await mentorleriAyarla({ teamId: "t1", mentorIds: ["men-1", "men-2"] });

    expect(s.ok).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("boş küme mentörleri temizler", async () => {
    prismaMock.team.findUnique.mockResolvedValue({ id: "t1" });

    expect((await mentorleriAyarla({ teamId: "t1", mentorIds: [] })).ok).toBe(true);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });
});

describe("takimaProjeAta", () => {
  beforeEach(() => {
    prismaMock.team.findUnique.mockResolvedValue({ id: "t1", members: uyeler(ASGARI_UYE) });
  });

  it("studentProfileId YAZMAZ — CHECK kısıtı sahibin tek olmasını istiyor", async () => {
    const s = await takimaProjeAta({ teamId: "t1", projectTemplateId: "pt1" });

    expect(s.ok).toBe(true);
    const veri = prismaMock.assignedProject.create.mock.calls[0][0].data;
    expect(veri.teamId).toBe("t1");
    expect(veri.projectTemplateId).toBe("pt1");
    expect(veri).not.toHaveProperty("studentProfileId");
  });

  /**
   * #503: Tekillik artık `tekilKey` üzerinden — eski
   * `@@unique([teamId, projectTemplateId])` onun yerine geçti.
   */
  it("⚠️ #503: tekrarlanamaz şablonda tekilKey DOLU — koruma sürer", async () => {
    await takimaProjeAta({ teamId: "t1", projectTemplateId: "pt1" });

    const veri = prismaMock.assignedProject.create.mock.calls[0][0].data;
    expect(veri.tekilKey).toBe("tm:t1:pt1");
  });

  it("⚠️ #503: tekrarlanabilir şablonda tekilKey NULL — birden çok kez atanabilir", async () => {
    prismaMock.projectTemplate.findUnique.mockResolvedValue({
      id: "pt1",
      tekrarlanabilir: true,
    });

    await takimaProjeAta({ teamId: "t1", projectTemplateId: "pt1" });

    const veri = prismaMock.assignedProject.create.mock.calls[0][0].data;
    expect(veri.tekilKey).toBeNull();
  });

  it("tek kişilik takıma proje atanamaz", async () => {
    // Tek kişilik "takım" bireysel atamanın karmaşık bir kopyası olurdu.
    prismaMock.team.findUnique.mockResolvedValue({ id: "t1", members: uyeler(1) });

    expect(await takimaProjeAta({ teamId: "t1", projectTemplateId: "pt1" })).toEqual({
      ok: false,
      neden: "yetersiz-uye",
    });
    expect(prismaMock.assignedProject.create).not.toHaveBeenCalled();
  });

  it("aynı proje ikinci kez atanamaz", async () => {
    prismaMock.assignedProject.create.mockRejectedValue(new Error("Unique constraint failed"));

    expect(await takimaProjeAta({ teamId: "t1", projectTemplateId: "pt1" })).toEqual({
      ok: false,
      neden: "zaten-atanmis",
    });
  });

  it("olmayan şablon reddedilir", async () => {
    prismaMock.projectTemplate.findUnique.mockResolvedValue(null);

    expect((await takimaProjeAta({ teamId: "t1", projectTemplateId: "yok" })).ok).toBe(false);
  });
});

describe("adimiUstlen", () => {
  it("adımı kişiye yazar", async () => {
    prismaMock.roadmapStep.updateMany.mockResolvedValue({ count: 1 });

    const s = await adimiUstlen({ stepId: "s1", userId: "u1" });

    expect(s.ok).toBe(true);
    expect(prismaMock.roadmapStep.updateMany).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { assigneeId: "u1" },
    });
  });

  it("null ile bırakılabilir", async () => {
    prismaMock.roadmapStep.updateMany.mockResolvedValue({ count: 1 });

    await adimiUstlen({ stepId: "s1", userId: null });

    expect(prismaMock.roadmapStep.updateMany).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { assigneeId: null },
    });
  });
});
