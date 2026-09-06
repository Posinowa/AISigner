// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { roadmapStep: { findMany: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { tamamlananAdimBasliklari } from "./gecmis";

/**
 * #423: Öğrencinin geçmişte tamamladığı adımlar.
 *
 * İkinci projesinde stajyer yine "Proje Kurulumu ve Gerekli Araçlar" adımını
 * alıyordu; geçmiş iş prompt'a hiç girmiyordu.
 */
beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.roadmapStep.findMany.mockResolvedValue([]);
});

const cagir = () =>
  tamamlananAdimBasliklari({ studentProfileId: "sp-1", haricAtamaId: "ap-1", azami: 20 });

describe("tamamlananAdimBasliklari", () => {
  it("yalnız COMPLETED adımlar sorulur", async () => {
    await cagir();
    const arg = prismaMock.roadmapStep.findMany.mock.calls[0][0];
    expect(arg.where.status).toBe("COMPLETED");
  });

  /*
   * ⚠️ #332'nin can alıcı noktası: takım atamasında `studentProfileId` NULL.
   * Yalnız eşitliğe bakan bir sorgu takım projelerini komple elerdi ve bu
   * HATA OLARAK GÖRÜNMEZDİ — liste sadece eksik gelirdi.
   */
  it("⚠️ sahiplik BİREYSEL ve TAKIM bağını birlikte sorar (#332)", async () => {
    await cagir();
    const arg = prismaMock.roadmapStep.findMany.mock.calls[0][0];
    expect(arg.where.roadmap.assignedProject).toEqual({
      OR: [
        { studentProfileId: "sp-1" },
        { team: { members: { some: { studentProfileId: "sp-1", leftAt: null } } } },
      ],
    });
  });

  it("⚠️ ŞU ANKİ atama hariç tutulur — kendi adımları geçmiş sayılmaz", async () => {
    await cagir();
    const arg = prismaMock.roadmapStep.findMany.mock.calls[0][0];
    expect(arg.where.roadmap.assignedProjectId).toEqual({ not: "ap-1" });
  });

  it("⚠️ EN YENİLER alınır ve sayı sınırlanır — prompt bütçesi", async () => {
    await cagir();
    const arg = prismaMock.roadmapStep.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual({ updatedAt: "desc" });
    expect(arg.take).toBe(20);
  });

  it("yalnız BAŞLIK okunur — açıklama prompt'u şişirirdi", async () => {
    await cagir();
    const arg = prismaMock.roadmapStep.findMany.mock.calls[0][0];
    expect(arg.select).toEqual({ title: true });
  });

  it("aynı başlık birden çok projede geçerse TEKİLLEŞTİRİLİR", async () => {
    prismaMock.roadmapStep.findMany.mockResolvedValue([
      { title: "Proje Kurulumu" },
      { title: "Proje Kurulumu" },
      { title: "Kimlik Doğrulama" },
    ]);
    expect(await cagir()).toEqual(["Proje Kurulumu", "Kimlik Doğrulama"]);
  });

  it("geçmiş yoksa boş liste", async () => {
    expect(await cagir()).toEqual([]);
  });
});
