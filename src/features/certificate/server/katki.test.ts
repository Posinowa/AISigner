import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    assignedProject: { findMany: vi.fn() },
    mentorAssignment: { findMany: vi.fn() },
    teamMentor: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { sertifikaKapsaminiGetir, ogrencininKatkisi } from "./katki";

const BEN = "u-ben";

/** Adım kurucusu: geçmiş satırı doluysa COMPLETED geçişini BU kullanıcı yazmış demektir. */
const adim = (
  status: string,
  opts: { ustlenen?: string | null; benTamamladim?: boolean } = {},
) => ({
  id: Math.random().toString(36).slice(2),
  status,
  assigneeId: opts.ustlenen ?? null,
  history: opts.benTamamladim ? [{ id: "h1" }] : [],
});

const atama = (o: Record<string, unknown> = {}) => ({
  id: "ap-1",
  teamId: null,
  team: null,
  projectTemplate: { title: "Proje", description: "d", difficulty: "MEDIUM", track: [] },
  roadmap: { steps: [] },
  ...o,
});

function mockla(atamalar: unknown[], bireysel: unknown[] = [], takim: unknown[] = []) {
  prismaMock.assignedProject.findMany.mockResolvedValue(atamalar);
  prismaMock.mentorAssignment.findMany.mockResolvedValue(bireysel);
  prismaMock.teamMentor.findMany.mockResolvedValue(takim);
}

/**
 * #449 — Katkı ölçümü.
 *
 * ⚠️ Bu kural bir BELGENİN dayanağı: fazla saymak işverene yanlış beyan,
 * eksik saymak gerçekten çalışmış stajyerin emeğini silmek olur.
 */
describe("ogrencininKatkisi", () => {
  it("üstlendiği VE tamamlanmış adım sayılır", () => {
    expect(ogrencininKatkisi([adim("COMPLETED", { ustlenen: BEN })], BEN)).toBe(1);
  });

  it("⚠️ üstlenmese de KENDİ tamamladığı adım sayılır", () => {
    expect(
      ogrencininKatkisi([adim("COMPLETED", { ustlenen: "baskasi", benTamamladim: true })], BEN),
    ).toBe(1);
  });

  it("⚠️ BAŞKASININ adımı sayılmaz — belge fazla beyan etmemeli", () => {
    expect(ogrencininKatkisi([adim("COMPLETED", { ustlenen: "baskasi" })], BEN)).toBe(0);
  });

  it("⚠️ üstlenmiş ama TAMAMLANMAMIŞ adım sayılmaz", () => {
    expect(ogrencininKatkisi([adim("IN_PROGRESS", { ustlenen: BEN })], BEN)).toBe(0);
  });

  it("⚠️ REVISION_REQUESTED sayılmaz — revizyon tamamlanmış değildir (#379)", () => {
    expect(ogrencininKatkisi([adim("REVISION_REQUESTED", { ustlenen: BEN })], BEN)).toBe(0);
  });

  it("aynı adım iki sinyalden de eşleşse BİR kez sayılır", () => {
    expect(
      ogrencininKatkisi([adim("COMPLETED", { ustlenen: BEN, benTamamladim: true })], BEN),
    ).toBe(1);
  });

  it("adım yoksa sıfır", () => {
    expect(ogrencininKatkisi([], BEN)).toBe(0);
  });
});

describe("sertifikaKapsaminiGetir — projeler (#449)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bireysel projede TÜM tamamlanan adımlar sayılır", async () => {
    mockla([
      atama({ roadmap: { steps: [adim("COMPLETED"), adim("COMPLETED"), adim("TODO")] } }),
    ]);

    const { projeler } = await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(projeler[0].completedStepsCount).toBe(2);
    expect(projeler[0].totalStepsCount).toBe(3);
    expect(projeler[0].takimAdi).toBeNull();
  });

  it("⚠️ TAKIM projesinde yalnız ÖĞRENCİNİN KENDİ katkısı sayılır", async () => {
    mockla([
      atama({
        teamId: "t-1",
        team: { name: "Takım A" },
        roadmap: {
          steps: [
            adim("COMPLETED", { ustlenen: BEN }),
            adim("COMPLETED", { ustlenen: "baskasi" }),
            adim("COMPLETED", { ustlenen: "baskasi" }),
            adim("TODO"),
          ],
        },
      }),
    ]);

    const { projeler } = await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    // Takımın 3 tamamlanmış adımı var ama bu stajyerin katkısı 1.
    expect(projeler[0].completedStepsCount).toBe(1);
    expect(projeler[0].totalStepsCount).toBe(4);
    expect(projeler[0].takimAdi).toBe("Takım A");
  });

  it("⚠️ katkısı OLMAYAN takım projesi listelenmez — belge onu kendi işi gibi göstermesin", async () => {
    mockla([
      atama({
        teamId: "t-1",
        team: { name: "Takım A" },
        roadmap: { steps: [adim("COMPLETED", { ustlenen: "baskasi" })] },
      }),
    ]);

    const { projeler } = await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(projeler).toHaveLength(0);
  });

  it("⚠️ katkısı olmayan BİREYSEL proje listelenir — başlamamış olmak da bir durum", async () => {
    mockla([atama({ roadmap: { steps: [adim("TODO")] } })]);

    const { projeler } = await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(projeler).toHaveLength(1);
    expect(projeler[0].completedStepsCount).toBe(0);
  });

  it("yol haritası yoksa çökmez", async () => {
    mockla([atama({ roadmap: null })]);

    const { projeler } = await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(projeler[0].totalStepsCount).toBe(0);
  });
});

describe("sertifikaKapsaminiGetir — atama kapsamı (#449)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("⚠️ TAKIM atamaları da sorulur — takımda studentProfileId NULL (#332)", async () => {
    mockla([]);

    await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    const kosul = JSON.stringify(prismaMock.assignedProject.findMany.mock.calls[0][0].where);
    expect(kosul).toContain("studentProfileId");
    expect(kosul).toContain("team");
  });

  /**
   * ⚠️ AYRILMIŞ ÜYE ELENMEZ — ve bu bilinçli bir sapma.
   *
   * `sahiplik.ts` içindeki `ogrencininAtamalariWhere` `leftAt: null` süzer; o
   * bir YETKİ sorusu. CLAUDE.md #332 ise `leftAt` alanının var olma sebebini
   * açıkça "katkı geçmişi SERTİFİKANIN dayanağı" diye yazıyor. Yetki kuralını
   * buraya uygulamak, şemanın korumak için tasarlandığı durumu düşürürdü:
   * takımda çalışıp ayrılan stajyerin emeği belgesinde hiç görünmezdi.
   */
  it("⚠️ ayrılmış üyenin takımı ELENMEZ — leftAt süzgeci YOK", async () => {
    mockla([]);

    await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    const kosul = JSON.stringify(prismaMock.assignedProject.findMany.mock.calls[0][0].where);
    expect(kosul).not.toContain("leftAt");
  });
});

describe("sertifikaKapsaminiGetir — mentörler (#449)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("⚠️ TAKIM mentörü de gelir — MentorAssignment'ta olmadığı için görünmüyordu", async () => {
    mockla(
      [],
      [],
      [{ mentor: { id: "m-takim", name: "Takım", lastName: "Mentörü", email: "t@x.com" } }],
    );

    const { mentorler } = await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(mentorler.map((m) => m.id)).toEqual(["m-takim"]);
  });

  it("⚠️ takım mentörü sorgusu ÖĞRENCİNİN TAKIMINI hedefler", async () => {
    // Mutasyon testinde bulundu: yalnız dönen değeri doğrulamak, sorgunun
    // yanlış takımı (ya da hiçbir takımı) sormasını yakalamıyordu — ki #449
    // tam olarak "takım mentörü hiç sorulmuyor" hatasıydı.
    mockla([], [], []);

    await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(prismaMock.teamMentor.findMany.mock.calls[0][0].where).toEqual({
      team: { members: { some: { studentProfileId: "sp-1" } } },
    });
  });

  it("⚠️ bireysel mentör sorgusu ÖĞRENCİNİN profilini hedefler", async () => {
    mockla([], [], []);

    await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(prismaMock.mentorAssignment.findMany.mock.calls[0][0].where).toEqual({
      studentProfileId: "sp-1",
    });
  });

  it("hem bireysel hem takım bağı olan mentör TEK kez listelenir", async () => {
    mockla(
      [],
      [{ mentor: { id: "m-1", name: "Can", lastName: "D", email: "c@x.com" } }],
      [{ mentor: { id: "m-1", name: "Can", lastName: "D", email: "c@x.com" } }],
    );

    const { mentorler } = await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(mentorler).toHaveLength(1);
  });

  it("⚠️ epostaDahil:false iken e-posta SORGUYA GİRMEZ (#208 PII kararı)", async () => {
    mockla([], [], []);

    await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: false });

    expect(
      prismaMock.mentorAssignment.findMany.mock.calls[0][0].select.mentor.select.email,
    ).toBe(false);
    expect(
      prismaMock.teamMentor.findMany.mock.calls[0][0].select.mentor.select.email,
    ).toBe(false);
  });

  it("epostaDahil:true iken e-posta çekilir (öğrencinin kendi görünümü)", async () => {
    mockla([], [], []);

    await sertifikaKapsaminiGetir("sp-1", BEN, { epostaDahil: true });

    expect(
      prismaMock.mentorAssignment.findMany.mock.calls[0][0].select.mentor.select.email,
    ).toBe(true);
  });
});
