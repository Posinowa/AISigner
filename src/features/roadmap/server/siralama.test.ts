// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Adım sıralaması (#406).
 *
 * Kilitlenen kararlar:
 *  - Adımın BU yol haritasına ait olduğu doğrulanır (#411'in hata sınıfı)
 *  - Sıra her yazmada 1..n yeniden numaralanır (bozuk veriyi onarır)
 *  - Tamamı tek $transaction içinde
 *  - Sınırda hiçbir yazma yapılmaz
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    roadmap: { findUnique: vi.fn() },
    roadmapStep: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { adimiTasi, komsuylaTakasEt, yenidenNumaralandir } from "./siralama";

const MENTOR = "men-1";

/** `mentoruMu` gerçek koddan geliyor; sahiplik şekli ona uygun kuruluyor. */
const yolHaritasi = (mentorId = MENTOR) => ({
  id: "rm-1",
  assignedProject: {
    studentProfileId: "sp-1",
    studentProfile: { mentorAssignments: [{ mentorId }] },
    teamId: null,
    team: null,
  },
});

const adimlar = (...idler: string[]) => idler.map((id) => ({ id }));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.roadmap.findUnique.mockResolvedValue(yolHaritasi());
  prismaMock.roadmapStep.findMany.mockResolvedValue(adimlar("a", "b", "c"));
  prismaMock.roadmapStep.update.mockImplementation((x: unknown) => x);
  prismaMock.$transaction.mockResolvedValue([]);
});

describe("komsuylaTakasEt", () => {
  it("yukarı taşır", () => {
    expect(komsuylaTakasEt(["a", "b", "c"], 1, "yukari")).toEqual(["b", "a", "c"]);
  });

  it("aşağı taşır", () => {
    expect(komsuylaTakasEt(["a", "b", "c"], 1, "asagi")).toEqual(["a", "c", "b"]);
  });

  it("İLK adım yukarı taşınamaz — null döner", () => {
    expect(komsuylaTakasEt(["a", "b"], 0, "yukari")).toBeNull();
  });

  it("SON adım aşağı taşınamaz — null döner", () => {
    expect(komsuylaTakasEt(["a", "b"], 1, "asagi")).toBeNull();
  });

  it("tek adımlı listede iki yön de null", () => {
    expect(komsuylaTakasEt(["a"], 0, "yukari")).toBeNull();
    expect(komsuylaTakasEt(["a"], 0, "asagi")).toBeNull();
  });

  it("özgün diziyi DEĞİŞTİRMEZ", () => {
    const asil = ["a", "b", "c"];
    komsuylaTakasEt(asil, 1, "yukari");
    expect(asil).toEqual(["a", "b", "c"]);
  });
});

describe("adimiTasi — yetki", () => {
  it("olmayan yol haritası → yol-haritasi-yok", async () => {
    prismaMock.roadmap.findUnique.mockResolvedValue(null);
    const s = await adimiTasi({ roadmapId: "yok", stepId: "a", yon: "asagi", mentorUserId: MENTOR });
    expect(s).toEqual({ ok: false, neden: "yol-haritasi-yok" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("BAŞKASININ yol haritası → yetki-yok, hiçbir şey yazılmaz", async () => {
    prismaMock.roadmap.findUnique.mockResolvedValue(yolHaritasi("baska-mentor"));
    const s = await adimiTasi({ roadmapId: "rm-1", stepId: "a", yon: "asagi", mentorUserId: MENTOR });
    expect(s).toEqual({ ok: false, neden: "yetki-yok" });
    expect(prismaMock.roadmapStep.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("⚠️ BAŞKA yol haritasının adımı → adim-yok (#411 hata sınıfı)", async () => {
    // Yetki yol haritasında var, ama adım o yol haritasına ait değil.
    const s = await adimiTasi({
      roadmapId: "rm-1",
      stepId: "baska-roadmapin-adimi",
      yon: "yukari",
      mentorUserId: MENTOR,
    });
    expect(s).toEqual({ ok: false, neden: "adim-yok" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("adimiTasi — yazma", () => {
  it("takas sonrası TÜM adımlar 1..n yeniden numaralanır", async () => {
    const s = await adimiTasi({ roadmapId: "rm-1", stepId: "c", yon: "yukari", mentorUserId: MENTOR });

    expect(s.ok).toBe(true);
    if (s.ok) expect(s.veri.sira).toEqual([
      { id: "a", order: 1 },
      { id: "c", order: 2 },
      { id: "b", order: 3 },
    ]);

    const yazilan = prismaMock.roadmapStep.update.mock.calls.map((c) => ({
      id: (c[0] as { where: { id: string } }).where.id,
      order: (c[0] as { data: { order: number } }).data.order,
    }));
    expect(yazilan).toEqual([
      { id: "a", order: 1 },
      { id: "c", order: 2 },
      { id: "b", order: 3 },
    ]);
  });

  it("⚠️ yazmaların TAMAMI tek $transaction içinde", async () => {
    await adimiTasi({ roadmapId: "rm-1", stepId: "a", yon: "asagi", mentorUserId: MENTOR });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // Yarıda kalan bir yeniden numaralandırma sırayı büsbütün bozardı.
    expect(prismaMock.$transaction.mock.calls[0][0]).toHaveLength(3);
  });

  it("⚠️ BOZUK sıra (yinelenen order) yazarken onarılır", async () => {
    // AI yinelenen `order` dönebiliyor (#410); findMany sıralı döndüğü için
    // taşıma sonrası numaralar her hâlükârda 1..n oluyor.
    prismaMock.roadmapStep.findMany.mockResolvedValue(adimlar("x", "y", "z", "w"));

    const s = await adimiTasi({ roadmapId: "rm-1", stepId: "w", yon: "yukari", mentorUserId: MENTOR });

    if (!s.ok) throw new Error("başarısız");
    expect(s.veri.sira.map((a) => a.order)).toEqual([1, 2, 3, 4]);
    expect(s.veri.sira.map((a) => a.id)).toEqual(["x", "y", "w", "z"]);
  });

  it("sıralama order sonra createdAt ile çözülür — bozuk veride kararlı", async () => {
    await adimiTasi({ roadmapId: "rm-1", stepId: "b", yon: "yukari", mentorUserId: MENTOR });

    const cagri = prismaMock.roadmapStep.findMany.mock.calls[0][0] as {
      where: { roadmapId: string };
      orderBy: { order?: string; createdAt?: string }[];
    };
    expect(cagri.where.roadmapId).toBe("rm-1");
    expect(cagri.orderBy).toEqual([{ order: "asc" }, { createdAt: "asc" }]);
  });

  it("İLK adım yukarı → sinirda, HİÇBİR yazma olmaz", async () => {
    const s = await adimiTasi({ roadmapId: "rm-1", stepId: "a", yon: "yukari", mentorUserId: MENTOR });
    expect(s).toEqual({ ok: false, neden: "sinirda" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("SON adım aşağı → sinirda, HİÇBİR yazma olmaz", async () => {
    const s = await adimiTasi({ roadmapId: "rm-1", stepId: "c", yon: "asagi", mentorUserId: MENTOR });
    expect(s).toEqual({ ok: false, neden: "sinirda" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

/**
 * ⚠️ #411: Silme sonrası yeniden numaralandırma KAPSAMI.
 *
 * Eski silme ucu adımı kimliğine göre siliyor ama sırayı URL'deki
 * `roadmapId`'ye göre numaralandırıyordu; ikisi farklı olduğunda YANLIŞ yol
 * haritası yeniden numaralanıyordu.
 */
describe("yenidenNumaralandir", () => {
  it("kapsam roadmapId ile daraltılır", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue(adimlar("a", "b"));
    await yenidenNumaralandir("rm-1");

    const cagri = prismaMock.roadmapStep.findMany.mock.calls[0][0] as {
      where: { roadmapId: string };
    };
    expect(cagri.where).toEqual({ roadmapId: "rm-1" });
  });

  it("kalan adımlar 1..n yazılır, TEK transaction içinde", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue(adimlar("a", "b", "c"));
    await yenidenNumaralandir("rm-1");

    const yazilan = prismaMock.roadmapStep.update.mock.calls.map((c) => ({
      id: (c[0] as { where: { id: string } }).where.id,
      order: (c[0] as { data: { order: number } }).data.order,
    }));
    expect(yazilan).toEqual([
      { id: "a", order: 1 },
      { id: "b", order: 2 },
      { id: "c", order: 3 },
    ]);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("adım kalmadıysa hiç yazma yapılmaz", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([]);
    await yenidenNumaralandir("rm-1");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
