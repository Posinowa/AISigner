// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * #329 — canlı akış merkezi.
 *
 * Kilitlenen garantiler:
 *   1. Sorgu sayısı KULLANICI SAYISINDAN BAĞIMSIZ — bütün mesele buydu.
 *   2. Kimse bağlı değilken sorgu atılmaz (boş pod veritabanını yormasın).
 *   3. Çakışma penceresi kopya olay üretmez.
 *   4. Tik hata verirse imleç İLERLEMEZ — o pencerenin mesajları kaybolmaz.
 *   5. Kullanıcı yalnızca KENDİ olaylarını alır.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    message: { findMany: vi.fn(), groupBy: vi.fn() },
    stepStatusHistory: { findMany: vi.fn() },
    typingSignal: { findMany: vi.fn() },
    notification: { groupBy: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  aboneOl,
  tikAt,
  akisiSifirla,
  bagliKullaniciSayisi,
  type CanliOlay,
} from "./canli-akis";

function abone(userId: string) {
  const olaylar: CanliOlay[] = [];
  const birak = aboneOl({
    userId,
    gorulen: new Set<string>(),
    gonder: (o) => olaylar.push(o),
  });
  return { olaylar, birak };
}

const mesaj = (id: string, receiverId: string, createdAt = new Date()) => ({
  id,
  senderId: "gonderen",
  receiverId,
  content: "merhaba",
  createdAt,
});

beforeEach(() => {
  vi.clearAllMocks();
  akisiSifirla();
  prismaMock.message.findMany.mockResolvedValue([]);
  prismaMock.message.groupBy.mockResolvedValue([]);
  prismaMock.stepStatusHistory.findMany.mockResolvedValue([]);
  prismaMock.typingSignal.findMany.mockResolvedValue([]);
  prismaMock.notification.groupBy.mockResolvedValue([]);
});

afterEach(() => akisiSifirla());

describe("sorgu yükü", () => {
  it("kimse bağlı değilken HİÇ sorgu atmaz", async () => {
    await tikAt();

    expect(prismaMock.message.findMany).not.toHaveBeenCalled();
    expect(prismaMock.message.groupBy).not.toHaveBeenCalled();
  });

  it("kullanıcı sayısı artınca sorgu sayısı ARTMAZ", async () => {
    // #329'un tüm gerekçesi bu: yoklama istemciden sunucuya taşındı ve
    // kullanıcı başına değil, tik başına sabit maliyete indi.
    for (const u of ["u1", "u2", "u3", "u4", "u5"]) abone(u);

    await tikAt();

    expect(prismaMock.message.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.groupBy).toHaveBeenCalledTimes(1);
    // Tek sorgu, tüm bağlı kullanıcıları kapsıyor.
    expect(prismaMock.message.findMany.mock.calls[0][0].where.receiverId.in).toHaveLength(5);
  });

  it("son abone ayrılınca kullanıcı listeden düşer", () => {
    const a = abone("u1");
    expect(bagliKullaniciSayisi()).toBe(1);
    a.birak();
    expect(bagliKullaniciSayisi()).toBe(0);
  });

  it("aynı kullanıcının iki sekmesi tek kayıt sayılır ama İKİSİ DE olay alır", async () => {
    const s1 = abone("u1");
    const s2 = abone("u1");
    prismaMock.message.findMany.mockResolvedValue([mesaj("m1", "u1")]);

    await tikAt();

    expect(bagliKullaniciSayisi()).toBe(1);
    expect(s1.olaylar.filter((o) => o.tip === "mesaj")).toHaveLength(1);
    expect(s2.olaylar.filter((o) => o.tip === "mesaj")).toHaveLength(1);
  });
});

describe("olay dağıtımı", () => {
  it("mesajı YALNIZCA alıcısına yollar", async () => {
    const a = abone("u1");
    const b = abone("u2");
    prismaMock.message.findMany.mockResolvedValue([mesaj("m1", "u1")]);

    await tikAt();

    expect(a.olaylar).toContainEqual(
      expect.objectContaining({ tip: "mesaj", mesajId: "m1", icerik: "merhaba" }),
    );
    expect(b.olaylar.filter((o) => o.tip === "mesaj")).toEqual([]);
  });

  it("çakışma penceresinde aynı mesajı İKİ KEZ yollamaz", async () => {
    // İmleç geriye çekildiği için aynı kayıt ardışık iki tikte dönebilir.
    const a = abone("u1");
    prismaMock.message.findMany.mockResolvedValue([mesaj("m1", "u1")]);

    await tikAt();
    await tikAt();

    expect(a.olaylar.filter((o) => o.tip === "mesaj")).toHaveLength(1);
  });

  it("okunmamış sayısını yalnızca DEĞİŞTİĞİNDE yollar", async () => {
    const a = abone("u1");
    prismaMock.message.groupBy.mockResolvedValue([{ receiverId: "u1", _count: { _all: 3 } }]);

    await tikAt();
    await tikAt(); // aynı sayı — ikinci olay olmamalı

    expect(a.olaylar.filter((o) => o.tip === "okunmamis")).toEqual([
      { tip: "okunmamis", sayi: 3 },
    ]);
  });

  it("okunmamış SIFIRA düşünce de yollar", async () => {
    // `groupBy` sıfır dönen kullanıcıyı listelemez; sıfırı elle doldurmasaydık
    // rozet okundu sonrası takılı kalırdı.
    const a = abone("u1");
    prismaMock.message.groupBy.mockResolvedValue([{ receiverId: "u1", _count: { _all: 2 } }]);
    await tikAt();

    prismaMock.message.groupBy.mockResolvedValue([]);
    await tikAt();

    expect(a.olaylar.filter((o) => o.tip === "okunmamis")).toEqual([
      { tip: "okunmamis", sayi: 2 },
      { tip: "okunmamis", sayi: 0 },
    ]);
  });

  it("adım sorgusu bağlı kullanıcılara göre SORGUDA filtrelenir", async () => {
    // #358: Önceden tüm platformun tamamlanma kayıtları çekilip JS tarafında
    // eleniyordu; `take` sınırı yüzünden bağlı bir öğrencinin tamamlaması
    // ilgisiz kayıtların arkasında kalıp KAÇIRILABİLİRDİ.
    abone("ogrenci-1");
    abone("ogrenci-2");

    await tikAt();

    // #332: Filtre artık bireysel VEYA takım üyeliği üzerinden (OR).
    const where = prismaMock.stepStatusHistory.findMany.mock.calls[0][0].where;
    const [bireysel, takim] = where.step.roadmap.assignedProject.OR;
    expect(bireysel.studentProfile.userId.in).toEqual(["ogrenci-1", "ogrenci-2"]);
    expect(takim.team.members.some.studentProfile.userId.in).toEqual([
      "ogrenci-1",
      "ogrenci-2",
    ]);
    // Ayrılmış üyeye kutlama gitmemeli.
    expect(takim.team.members.some.leftAt).toBeNull();
  });

  it("tamamlanan adımı adımın SAHİBİNE yollar", async () => {
    const sahip = abone("ogrenci-1");
    const baskasi = abone("ogrenci-2");
    prismaMock.stepStatusHistory.findMany.mockResolvedValue([
      {
        stepId: "s1",
        step: {
          title: "Not ekleme ucu",
          roadmap: { assignedProject: { studentProfile: { userId: "ogrenci-1" } } },
        },
      },
    ]);

    await tikAt();

    expect(sahip.olaylar).toContainEqual({
      tip: "adim-tamamlandi",
      stepId: "s1",
      baslik: "Not ekleme ucu",
    });
    expect(baskasi.olaylar.filter((o) => o.tip === "adim-tamamlandi")).toEqual([]);
  });

  it("bağlantısı kopmuş abone diğerlerini etkilemez", async () => {
    // Kapanmış bir akışa yazmak fırlatır; tik bunun yüzünden durmamalı.
    aboneOl({
      userId: "u1",
      gorulen: new Set(),
      gonder: () => {
        throw new Error("kapalı akış");
      },
    });
    const saglam = abone("u2");
    prismaMock.message.findMany.mockResolvedValue([mesaj("m1", "u1"), mesaj("m2", "u2")]);

    await tikAt();

    expect(saglam.olaylar).toContainEqual(
      expect.objectContaining({ tip: "mesaj", mesajId: "m2" }),
    );
  });
});

describe("dayanıklılık", () => {
  it("tik hata verirse FIRLATMAZ", async () => {
    abone("u1");
    prismaMock.message.findMany.mockRejectedValue(new Error("db down"));

    await expect(tikAt()).resolves.toBeUndefined();
  });

  it("hata sonrası İMLEÇ İLERLEMEZ — o pencerenin mesajları kaybolmaz", async () => {
    const a = abone("u1");
    prismaMock.message.findMany.mockRejectedValue(new Error("db down"));
    await tikAt();

    // DB geri geldi: hata anındaki mesaj hâlâ pencerede olmalı.
    prismaMock.message.findMany.mockResolvedValue([mesaj("m1", "u1")]);
    await tikAt();

    expect(a.olaylar.filter((o) => o.tip === "mesaj")).toHaveLength(1);
  });
});

/**
 * #354 — "yazıyor..." göstergesi.
 *
 * Kilitlenen kararlar:
 *   - Olay yalnızca DEĞİŞTİĞİNDE gider; her tikte gitmesi akışı yoklamaya
 *     çevirirdi (biri yazarken 2 sn'de bir olay).
 *   - Küme BOŞALMASI da bir değişikliktir — sekmesini kapatan kullanıcı için
 *     göstergenin sönmesi buna dayanıyor, ayrı bir "bıraktı" olayı yok.
 *   - Kullanıcı yalnızca KENDİSİNE yazanları görür.
 */
describe("yazıyor sinyali (#354)", () => {
  it("bana yazanı bildirir", async () => {
    const a = abone("u1");
    prismaMock.typingSignal.findMany.mockResolvedValue([
      { fromUserId: "men-1", toUserId: "u1" },
    ]);

    await tikAt();

    expect(a.olaylar).toContainEqual({ tip: "yaziyor", kimler: ["men-1"] });
    a.birak();
  });

  it("BAŞKASINA yazılan sinyal bana gelmez", async () => {
    const a = abone("u1");
    const b = abone("u2");
    prismaMock.typingSignal.findMany.mockResolvedValue([
      { fromUserId: "men-1", toUserId: "u2" },
    ]);

    await tikAt();

    expect(a.olaylar.filter((o) => o.tip === "yaziyor")).toEqual([
      { tip: "yaziyor", kimler: [] },
    ]);
    expect(b.olaylar).toContainEqual({ tip: "yaziyor", kimler: ["men-1"] });
    a.birak();
    b.birak();
  });

  it("DEĞİŞMEDİKÇE tekrar yollanmaz — akış yoklamaya dönmemeli", async () => {
    const a = abone("u1");
    prismaMock.typingSignal.findMany.mockResolvedValue([
      { fromUserId: "men-1", toUserId: "u1" },
    ]);

    await tikAt();
    await tikAt();
    await tikAt();

    expect(a.olaylar.filter((o) => o.tip === "yaziyor")).toHaveLength(1);
    a.birak();
  });

  it("sinyal DÜŞÜNCE gösterge sönsün diye boş küme yollanır", async () => {
    const a = abone("u1");
    prismaMock.typingSignal.findMany.mockResolvedValue([
      { fromUserId: "men-1", toUserId: "u1" },
    ]);
    await tikAt();

    // Süre doldu / durduruldu: satır artık dönmüyor.
    prismaMock.typingSignal.findMany.mockResolvedValue([]);
    await tikAt();

    const yaziyorOlaylari = a.olaylar.filter((o) => o.tip === "yaziyor");
    expect(yaziyorOlaylari).toEqual([
      { tip: "yaziyor", kimler: ["men-1"] },
      { tip: "yaziyor", kimler: [] },
    ]);
    a.birak();
  });

  it("kimlik sırası değişince YENİDEN yollanmaz — sıralı karşılaştırma", async () => {
    const a = abone("u1");
    prismaMock.typingSignal.findMany.mockResolvedValue([
      { fromUserId: "b", toUserId: "u1" },
      { fromUserId: "a", toUserId: "u1" },
    ]);
    await tikAt();

    prismaMock.typingSignal.findMany.mockResolvedValue([
      { fromUserId: "a", toUserId: "u1" },
      { fromUserId: "b", toUserId: "u1" },
    ]);
    await tikAt();

    expect(a.olaylar.filter((o) => o.tip === "yaziyor")).toHaveLength(1);
    a.birak();
  });

  it("ayrılan abonenin durumu UNUTULUR — yeniden bağlanınca gösterge doğru kurulur", async () => {
    const a = abone("u1");
    prismaMock.typingSignal.findMany.mockResolvedValue([
      { fromUserId: "men-1", toUserId: "u1" },
    ]);
    await tikAt();
    a.birak();

    const b = abone("u1");
    await tikAt();

    // Durum sıfırlanmasaydı yeni bağlantı "kimse yazmıyor" sanırdı.
    expect(b.olaylar).toContainEqual({ tip: "yaziyor", kimler: ["men-1"] });
    b.birak();
  });

  it("tik başına TEK sorgu — kullanıcı sayısından bağımsız", async () => {
    const aboneler = ["u1", "u2", "u3", "u4"].map(abone);
    await tikAt();

    expect(prismaMock.typingSignal.findMany).toHaveBeenCalledTimes(1);
    for (const a of aboneler) a.birak();
  });
});

/**
 * #380 — Okunmamış BİLDİRİM sayacı mevcut tikten besleniyor.
 *
 * Ayrı bir yoklama kurmak, #329'un "maliyet kullanıcı sayısından bağımsız"
 * kazanımını aşındırırdı (#354'teki aynı karar).
 */
describe("bildirim sayacı (#380)", () => {
  it("sayı DEĞİŞİNCE olay gider", async () => {
    const a = abone("u1");
    prismaMock.notification.groupBy.mockResolvedValue([
      { userId: "u1", _count: { _all: 3 } },
    ]);

    await tikAt();

    expect(a.olaylar).toContainEqual({ tip: "bildirim", okunmamis: 3 });
    a.birak();
  });

  it("DEĞİŞMEDİKÇE tekrar yollanmaz — akış yoklamaya dönmemeli", async () => {
    const a = abone("u1");
    prismaMock.notification.groupBy.mockResolvedValue([
      { userId: "u1", _count: { _all: 3 } },
    ]);

    await tikAt();
    await tikAt();
    await tikAt();

    expect(a.olaylar.filter((o) => o.tip === "bildirim")).toHaveLength(1);
    a.birak();
  });

  it("SIFIRA düşmek de bir değişiklik — kullanıcı zili açtığında rozet sönmeli", async () => {
    const a = abone("u1");
    prismaMock.notification.groupBy.mockResolvedValue([
      { userId: "u1", _count: { _all: 2 } },
    ]);
    await tikAt();

    // groupBy sıfır dönen kullanıcıyı HİÇ listelemez.
    prismaMock.notification.groupBy.mockResolvedValue([]);
    await tikAt();

    expect(a.olaylar.filter((o) => o.tip === "bildirim")).toEqual([
      { tip: "bildirim", okunmamis: 2 },
      { tip: "bildirim", okunmamis: 0 },
    ]);
    a.birak();
  });

  it("BAŞKASININ sayacı bana gelmez", async () => {
    const a = abone("u1");
    const b = abone("u2");
    prismaMock.notification.groupBy.mockResolvedValue([
      { userId: "u2", _count: { _all: 5 } },
    ]);

    await tikAt();

    expect(a.olaylar).toContainEqual({ tip: "bildirim", okunmamis: 0 });
    expect(b.olaylar).toContainEqual({ tip: "bildirim", okunmamis: 5 });
    a.birak();
    b.birak();
  });

  it("tik başına TEK sorgu", async () => {
    const aboneler = ["u1", "u2", "u3"].map(abone);
    await tikAt();

    expect(prismaMock.notification.groupBy).toHaveBeenCalledTimes(1);
    for (const a of aboneler) a.birak();
  });
});
