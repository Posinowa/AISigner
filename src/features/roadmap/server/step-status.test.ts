import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    roadmapStep: { update: vi.fn() },
    stepStatusHistory: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { adimDurumunuDegistir } from "./step-status";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.roadmapStep.update.mockReturnValue("GUNCELLEME_ISLEMI");
  prismaMock.stepStatusHistory.create.mockReturnValue("GECMIS_ISLEMI");
  // $transaction dizi alır ve sonuçları döndürür.
  prismaMock.$transaction.mockResolvedValue([{ id: "s1", status: "IN_PROGRESS" }, {}]);
});

describe("adimDurumunuDegistir", () => {
  it("durumu günceller ve güncellenmiş adımı döner", async () => {
    const sonuc = await adimDurumunuDegistir({
      stepId: "s1",
      yeniDurum: "IN_PROGRESS",
      oncekiDurum: "TODO",
      degistirenId: "u1",
    });

    expect(sonuc).toEqual({ id: "s1", status: "IN_PROGRESS" });
    expect(prismaMock.roadmapStep.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "IN_PROGRESS" },
    });
  });

  it("geçişi ÖNCEKİ ve YENİ durumla birlikte kaydeder", async () => {
    // Darboğaz analizi "TODO -> IN_PROGRESS ne zaman oldu" sorusunu soracak;
    // yalnız yeni durumu kaydetmek yetmez.
    await adimDurumunuDegistir({
      stepId: "s1",
      yeniDurum: "COMPLETED",
      oncekiDurum: "IN_PROGRESS",
      degistirenId: "u1",
    });

    expect(prismaMock.stepStatusHistory.create).toHaveBeenCalledWith({
      data: {
        stepId: "s1",
        fromStatus: "IN_PROGRESS",
        toStatus: "COMPLETED",
        changedById: "u1",
      },
    });
  });

  // KRİTİK: güncelleme başarılı olup geçmiş yazımı başarısız olursa geçmiş
  // sessizce eksilir ve bunu kimse fark etmez. İkisi ya birlikte ya hiç.
  it("güncelleme ve geçmiş TEK transaction'da yazılır", async () => {
    await adimDurumunuDegistir({
      stepId: "s1",
      yeniDurum: "IN_PROGRESS",
      oncekiDurum: "TODO",
      degistirenId: "u1",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    const islemler = prismaMock.$transaction.mock.calls[0]![0];
    expect(islemler).toEqual(["GUNCELLEME_ISLEMI", "GECMIS_ISLEMI"]);
  });

  it("transaction başarısız olursa hata YUTULMAZ", async () => {
    // Sessiz başarısızlık, eksik geçmişten daha kötü: kullanıcı adımı
    // tamamladığını sanır ama durum değişmemiştir.
    prismaMock.$transaction.mockRejectedValue(new Error("db düştü"));

    await expect(
      adimDurumunuDegistir({
        stepId: "s1",
        yeniDurum: "COMPLETED",
        oncekiDurum: "IN_PROGRESS",
        degistirenId: "u1",
      }),
    ).rejects.toThrow("db düştü");
  });

  it("bilinmeyen önceki durum null olarak kaydedilir", async () => {
    await adimDurumunuDegistir({
      stepId: "s1",
      yeniDurum: "IN_PROGRESS",
      oncekiDurum: null,
      degistirenId: null,
    });

    expect(prismaMock.stepStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: null, changedById: null }),
      }),
    );
  });
});
