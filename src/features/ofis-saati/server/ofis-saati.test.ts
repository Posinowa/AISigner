// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Ofis saati (#398).
 *
 * Kilitlenen kararlar:
 *  - ÇİFT REZERVASYON veritabanında engellenir (koşullu UPDATE)
 *  - Stajyer yalnız KENDİ mentörünün slotunu rezerve edebilir
 *  - Yetkisizlik de "slot yok" döner: başkasının takvimi sızmasın
 *  - İptal edilen slot yeniden BOŞA düşer
 *  - Rezerve edilmiş slot SİLİNEMEZ
 */

const { prismaMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    ofisSaatiSlotu: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    studentProfile: { findFirst: vi.fn(), findMany: vi.fn() },
  },
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import {
  dilimlereBol,
  slotlariAc,
  slotuRezerveEt,
  rezervasyonuIptalEt,
  slotuSil,
  ogrencininGorebilecegiSlotlar,
  DILIM_DK,
} from "./ofis-saati";

const DK = 60_000;
const ileri = (dk: number) => new Date(Date.now() + dk * DK);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.ofisSaatiSlotu.createMany.mockResolvedValue({ count: 1 });
  prismaMock.ofisSaatiSlotu.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.ofisSaatiSlotu.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.studentProfile.findFirst.mockResolvedValue({ id: "sp-1" });
});

describe("dilimlereBol", () => {
  it("aralığı eşit dilimlere böler", () => {
    const d = dilimlereBol(new Date(0), new Date(60 * DK));
    expect(d).toHaveLength(60 / DILIM_DK);
  });

  it("ARTAN kısım atılır — yarım dilim rezerve edilmemeli", () => {
    // 50 dakika = 2 tam dilim + 10 dk artan.
    const d = dilimlereBol(new Date(0), new Date(50 * DK));
    expect(d).toHaveLength(2);
  });

  it("dilimden kısa aralıkta hiç dilim üretilmez", () => {
    expect(dilimlereBol(new Date(0), new Date(5 * DK))).toHaveLength(0);
  });

  it("ters aralıkta boş döner", () => {
    expect(dilimlereBol(new Date(60 * DK), new Date(0))).toHaveLength(0);
  });
});

describe("slot açma", () => {
  const ac = (bas: Date, bit: Date) =>
    slotlariAc({ mentorUserId: "men-1", baslangic: bas, bitis: bit });

  it("geçerli aralıkta slotlar oluşur", async () => {
    prismaMock.ofisSaatiSlotu.createMany.mockResolvedValue({ count: 6 });

    const s = await ac(ileri(60), ileri(180));

    expect(s.ok).toBe(true);
    expect(prismaMock.ofisSaatiSlotu.createMany).toHaveBeenCalled();
  });

  it("GEÇMİŞE slot açılamaz", async () => {
    const s = await ac(new Date(Date.now() - 60 * DK), ileri(60));
    expect(s).toEqual({ ok: false, neden: "gecmis-zaman" });
    expect(prismaMock.ofisSaatiSlotu.createMany).not.toHaveBeenCalled();
  });

  it("ters aralık reddedilir", async () => {
    const s = await ac(ileri(180), ileri(60));
    expect(s).toEqual({ ok: false, neden: "gecersiz-aralik" });
  });

  it("dilimden kısa aralık reddedilir", async () => {
    const s = await ac(ileri(60), ileri(65));
    expect(s).toEqual({ ok: false, neden: "gecersiz-aralik" });
  });

  it("aşırı uzun aralık reddedilir — takvim kazayla şişmesin", async () => {
    const s = await ac(ileri(60), ileri(60 + 20 * 30));
    expect(s).toEqual({ ok: false, neden: "cok-uzun" });
  });
});

describe("rezervasyon", () => {
  const slot = (over: Record<string, unknown> = {}) => ({
    id: "slot-1",
    mentorId: "men-1",
    baslangic: ileri(60),
    ...over,
  });

  const rezerve = () =>
    slotuRezerveEt({ slotId: "slot-1", studentUserId: "ogr-1", not: "Docker sorunu" });

  it("boş slot rezerve edilir", async () => {
    prismaMock.ofisSaatiSlotu.findUnique.mockResolvedValue(slot());

    const s = await rezerve();

    expect(s.ok).toBe(true);
    const cagri = prismaMock.ofisSaatiSlotu.updateMany.mock.calls[0][0];
    expect(cagri.data.rezerveEdenId).toBe("ogr-1");
    expect(cagri.data.ogrenciNotu).toBe("Docker sorunu");
  });

  it("⚠️ ÇİFT REZERVASYON veritabanında engellenir — koşullu UPDATE", async () => {
    prismaMock.ofisSaatiSlotu.findUnique.mockResolvedValue(slot());

    await rezerve();

    // "Önce sorgula sonra yaz" yarışı kaybederdi; koşul UPDATE'in içinde.
    const where = prismaMock.ofisSaatiSlotu.updateMany.mock.calls[0][0].where;
    expect(where.id).toBe("slot-1");
    expect(where.rezerveEdenId).toBeNull();
  });

  it("⚠️ yarışı KAYBEDEN istek 'dolu' alır", async () => {
    prismaMock.ofisSaatiSlotu.findUnique.mockResolvedValue(slot());
    // İki eşzamanlı istekten ikincisi satırı bulamaz.
    prismaMock.ofisSaatiSlotu.updateMany.mockResolvedValue({ count: 0 });

    expect(await rezerve()).toEqual({ ok: false, neden: "dolu" });
  });

  it("olmayan slot → slot-yok", async () => {
    prismaMock.ofisSaatiSlotu.findUnique.mockResolvedValue(null);
    expect(await rezerve()).toEqual({ ok: false, neden: "slot-yok" });
  });

  it("⚠️ BAŞKASININ mentörünün slotu → 'slot-yok' (varlığı sızmasın)", async () => {
    prismaMock.ofisSaatiSlotu.findUnique.mockResolvedValue(slot());
    prismaMock.studentProfile.findFirst.mockResolvedValue(null);

    expect(await rezerve()).toEqual({ ok: false, neden: "slot-yok" });
    expect(prismaMock.ofisSaatiSlotu.updateMany).not.toHaveBeenCalled();
  });

  it("yetki BİREYSEL ve TAKIM bağını birlikte sorar (#370)", async () => {
    prismaMock.ofisSaatiSlotu.findUnique.mockResolvedValue(slot());

    await rezerve();

    const where = prismaMock.studentProfile.findFirst.mock.calls[0][0].where;
    expect(where.userId).toBe("ogr-1");
    expect(where.OR[0].mentorAssignments.some.mentorId).toBe("men-1");
    expect(where.OR[1].teamMemberships.some.team.mentors.some.mentorId).toBe("men-1");
  });

  it("GEÇMİŞ slot rezerve edilemez", async () => {
    prismaMock.ofisSaatiSlotu.findUnique.mockResolvedValue(
      slot({ baslangic: new Date(Date.now() - 10 * DK) }),
    );

    expect(await rezerve()).toEqual({ ok: false, neden: "gecmis-zaman" });
  });
});

describe("iptal ve silme", () => {
  it("stajyer KENDİ rezervasyonunu iptal eder — slot BOŞA düşer", async () => {
    const s = await rezervasyonuIptalEt({ slotId: "slot-1", userId: "ogr-1", rol: "STUDENT" });

    expect(s.ok).toBe(true);
    const cagri = prismaMock.ofisSaatiSlotu.updateMany.mock.calls[0][0];
    expect(cagri.where.rezerveEdenId).toBe("ogr-1");
    expect(cagri.data.rezerveEdenId).toBeNull();
  });

  it("mentör KENDİ slotundaki rezervasyonu iptal eder", async () => {
    await rezervasyonuIptalEt({ slotId: "slot-1", userId: "men-1", rol: "MENTOR" });

    const where = prismaMock.ofisSaatiSlotu.updateMany.mock.calls[0][0].where;
    expect(where.mentorId).toBe("men-1");
  });

  it("BAŞKASININ rezervasyonuna dokunulamaz", async () => {
    prismaMock.ofisSaatiSlotu.updateMany.mockResolvedValue({ count: 0 });

    expect(
      await rezervasyonuIptalEt({ slotId: "slot-1", userId: "yabanci", rol: "STUDENT" }),
    ).toEqual({ ok: false, neden: "slot-yok" });
  });

  it("⚠️ REZERVE EDİLMİŞ slot silinemez — stajyerin görüşmesi habersiz kaybolmasın", async () => {
    await slotuSil({ slotId: "slot-1", mentorUserId: "men-1" });

    const where = prismaMock.ofisSaatiSlotu.deleteMany.mock.calls[0][0].where;
    expect(where.rezerveEdenId).toBeNull();
    expect(where.mentorId).toBe("men-1");
  });

  it("silinemeyen slot slot-yok döner", async () => {
    prismaMock.ofisSaatiSlotu.deleteMany.mockResolvedValue({ count: 0 });

    expect(await slotuSil({ slotId: "slot-1", mentorUserId: "men-1" })).toEqual({
      ok: false,
      neden: "slot-yok",
    });
  });
});

/**
 * ⚠️ SAAT DİLİMİ — #398 doğrulama listesindeki madde.
 *
 * Slotlar UTC saklanıyor, kullanıcıya YEREL saatiyle gösteriliyor. Tarih
 * kayması riski, dilimleme takvim alanlarıyla (getHours/setDate) yapılsaydı
 * ortaya çıkardı: yerel gece yarısını ya da yaz saati geçişini aşan bir aralık
 * yanlış anlara düşerdi. `dilimlereBol` bilerek EPOCH ARİTMETİĞİ kullanıyor.
 */
describe("saat dilimi sınırları", () => {
  it("yerel gece yarısını aşan aralıkta dilimler kaymaz", () => {
    // 22:40–00:00 (UTC+3 yerel) = 19:40–21:00 UTC. Gün DEĞİŞİYOR.
    const bas = new Date("2026-09-10T19:40:00.000Z");
    const bit = new Date("2026-09-10T21:00:00.000Z");
    const d = dilimlereBol(bas, bit);

    expect(d).toHaveLength(4);
    expect(d[0].baslangic.toISOString()).toBe("2026-09-10T19:40:00.000Z");
    expect(d[3].bitis.toISOString()).toBe("2026-09-10T21:00:00.000Z");
    // Her dilim tam 20 dakika — hiçbiri gün sınırında uzayıp kısalmıyor.
    for (const x of d) {
      expect(x.bitis.getTime() - x.baslangic.getTime()).toBe(20 * 60_000);
    }
  });

  /*
   * ⚠️ BU TEST TESTİN KENDİ SAAT DİLİMİNİ DEĞİŞTİRİYOR — zorunlu.
   *
   * Geliştirme makineleri UTC+3'te (Türkiye 2016'dan beri yaz saati
   * uygulamıyor), yani yerel takvim aritmetiği burada epoch aritmetiğiyle
   * AYNI sonucu verir ve hatalı bir uygulama testten geçer. Ölçümü gerçekten
   * yapabilmek için yaz saati uygulayan bir dilime geçiliyor.
   *
   * Ölçüldü: TZ=Europe/Berlin iken `setMinutes(+20)` 00:40Z üzerinde
   * 02:00Z veriyor — 80 dakikalık sıçrama.
   */
  const oncekiTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = "Europe/Berlin";
  });
  afterEach(() => {
    process.env.TZ = oncekiTz;
  });

  it("yaz saati geçişini aşan aralıkta da dilimler tam 20 dakika kalır", () => {
    // Avrupa yaz saati sonu: 2026-10-25 01:00 UTC'de saatler geri alınır.
    const bas = new Date("2026-10-25T00:40:00.000Z");
    const bit = new Date("2026-10-25T01:40:00.000Z");
    const d = dilimlereBol(bas, bit);

    expect(d).toHaveLength(3);
    expect(d.map((x) => x.baslangic.toISOString())).toEqual([
      "2026-10-25T00:40:00.000Z",
      "2026-10-25T01:00:00.000Z",
      "2026-10-25T01:20:00.000Z",
    ]);
    for (const x of d) {
      expect(x.bitis.getTime() - x.baslangic.getTime()).toBe(20 * 60_000);
    }
    // Geçiş anında bir dilim ne yutuluyor ne çiftleniyor.
    expect(new Set(d.map((x) => x.baslangic.getTime())).size).toBe(3);
  });

  it("yıl sınırını aşan aralıkta tarih ileri sarar", () => {
    const bas = new Date("2026-12-31T23:20:00.000Z");
    const bit = new Date("2027-01-01T00:20:00.000Z");
    const d = dilimlereBol(bas, bit);

    expect(d).toHaveLength(3);
    expect(d[2].bitis.toISOString()).toBe("2027-01-01T00:20:00.000Z");
  });
});

/**
 * ⚠️ Görüşme bağlantısı yalnız REZERVE EDİLMİŞ slotta dönmeli.
 *
 * Arayüz stajyere "bağlantıyı rezervasyon sonrası görürsün" diyor; sözü
 * tutan yer sunucu. Canlı testte bulundu: ilk sürüm bağlantıyı her slotta
 * dönüyordu, arayüz göstermese de ağ yanıtında duruyordu.
 */
describe("görüşme bağlantısının kapsamı", () => {
  const LINK = "https://meet.google.com/abc-defg-hij";

  const kur = (rezerveEdenId: string | null) => {
    prismaMock.studentProfile.findMany.mockResolvedValue([
      { mentorAssignments: [{ mentorId: "men-1" }], teamMemberships: [] },
    ]);
    prismaMock.ofisSaatiSlotu.findMany.mockResolvedValue([
      {
        id: "slot-1",
        baslangic: ileri(60),
        bitis: ileri(80),
        rezerveEdenId,
        mentor: {
          id: "men-1",
          name: "Mentor",
          lastName: null,
          mentorProfile: { gorusmeLinki: LINK },
        },
      },
    ]);
  };

  it("BOŞ slotta bağlantı DÖNMEZ", async () => {
    kur(null);
    const [slot] = await ogrencininGorebilecegiSlotlar("ogr-1");
    expect(slot.mentor.mentorProfile).toBeNull();
    // Yanıtın hiçbir yerinde sızmamalı.
    expect(JSON.stringify(slot)).not.toContain("meet.google.com");
  });

  it("KENDİ rezervasyonunda bağlantı döner", async () => {
    kur("ogr-1");
    const [slot] = await ogrencininGorebilecegiSlotlar("ogr-1");
    expect(slot.mentor.mentorProfile?.gorusmeLinki).toBe(LINK);
  });

  it("mentörü olmayan stajyere hiç slot dönmez", async () => {
    prismaMock.studentProfile.findMany.mockResolvedValue([
      { mentorAssignments: [], teamMemberships: [] },
    ]);
    expect(await ogrencininGorebilecegiSlotlar("ogr-1")).toEqual([]);
    expect(prismaMock.ofisSaatiSlotu.findMany).not.toHaveBeenCalled();
  });
});

/**
 * ⚠️ Slot tekilliği — canlı testte bulundu.
 *
 * "Aralık aç" iki kez çalıştığında takvim ikizleniyordu: aynı mentörün aynı
 * 14:00 dilimi iki satır oluyor, stajyer aynı görüşmeyi listede iki kez
 * görüyordu. Kural artık `@@unique([mentorId, baslangic])` ile
 * VERİTABANINDA; çağıran taraf hatayı yükseltmek yerine atlıyor çünkü
 * 14:00–15:00 açtıktan sonra 14:00–16:00 açmak meşru bir istek.
 */
describe("slot tekilliği", () => {
  it("createMany ÇAKIŞANLARI ATLAR — çift tık takvimi ikizlemesin", async () => {
    await slotlariAc({ mentorUserId: "men-1", baslangic: ileri(60), bitis: ileri(120) });

    const cagri = prismaMock.ofisSaatiSlotu.createMany.mock.calls[0][0];
    expect(cagri.skipDuplicates).toBe(true);
  });

  it("hiç yeni dilim oluşmazsa count 0 döner — uydurulmuş sayı yok", async () => {
    prismaMock.ofisSaatiSlotu.createMany.mockResolvedValue({ count: 0 });

    const sonuc = await slotlariAc({
      mentorUserId: "men-1",
      baslangic: ileri(60),
      bitis: ileri(120),
    });

    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) expect(sonuc.veri.olusturulan).toBe(0);
  });
});
