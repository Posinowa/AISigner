// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #331 — analitik sonuç dönüşümleri.
 *
 * SQL'in KENDİSİ burada test EDİLMİYOR: mock bir Prisma, sorgunun Postgres'te
 * doğru çalıştığını kanıtlamaz (bu depoda `DISTINCT ON` dersi tam olarak buydu).
 * Sorgular gerçek Postgres'e karşı, ekilmiş bilinen değerlerle doğrulandı.
 *
 * Burada test edilen, sorgudan SONRAKİ mantık:
 *   1. BigInt sayaçlar sayıya çevrilir (aksi halde JSON serileştirme patlar)
 *   2. "Hiç hareket yok" epoch tarihi, 20 bin günlük sessizliğe dönüşmez
 *   3. Sinyali olmayan öğrenci risk listesine GİRMEZ
 */

const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));

import {
  darbogazAnalizi,
  mentorYanitSuresi,
  riskliOgrenciler,
  SESSIZLIK_GUN,
} from "./analiz";

const GUN_MS = 86_400_000;

beforeEach(() => vi.clearAllMocks());

describe("darbogazAnalizi", () => {
  it("saatleri güne çevirir ve BigInt sayacı sayıya döndürür", async () => {
    queryRawMock.mockResolvedValue([
      {
        projeBasligi: "Blog API",
        adimSirasi: 3,
        adimBasligi: "Docker kurulumu",
        tamamlayanSayisi: BigInt(7),
        ortalamaSaat: 96,
        ortancaSaat: 72,
      },
    ]);

    const [s] = await darbogazAnalizi();

    expect(s.ortalamaGun).toBe(4);
    expect(s.ortancaGun).toBe(3);
    // BigInt JSON'a serileşmez; sınırda patlamasın diye burada çevriliyor.
    expect(s.tamamlayanSayisi).toBe(7);
    expect(typeof s.tamamlayanSayisi).toBe("number");
  });

  it("null süreleri sıfıra indirir, çökmez", async () => {
    queryRawMock.mockResolvedValue([
      {
        projeBasligi: "P",
        adimSirasi: 1,
        adimBasligi: "A",
        tamamlayanSayisi: BigInt(0),
        ortalamaSaat: null,
        ortancaSaat: null,
      },
    ]);

    const [s] = await darbogazAnalizi();
    expect(s.ortancaGun).toBe(0);
  });
});

describe("mentorYanitSuresi", () => {
  it("saatleri bir ondalığa yuvarlar", async () => {
    queryRawMock.mockResolvedValue([
      {
        mentorId: "m1",
        ad: "Ayşe",
        soyad: "Y",
        email: "m1@t.test",
        yanitlananSoru: BigInt(12),
        ortalamaSaat: 3.4567,
        ortancaSaat: 2.1234,
      },
    ]);

    const [y] = await mentorYanitSuresi();

    expect(y.ortalamaSaat).toBe(3.5);
    expect(y.ortancaSaat).toBe(2.1);
    expect(y.yanitlananSoru).toBe(12);
  });
});

describe("riskliOgrenciler", () => {
  const satir = (ek: Record<string, unknown>) => ({
    studentUserId: "u1",
    ad: "Ali",
    soyad: "V",
    email: "u1@t.test",
    sonHareket: new Date(),
    takilanAdim: BigInt(0),
    bekleyenSoru: false,
    ...ek,
  });

  it("epoch tarihini 'hiç hareket yok' olarak çevirir", async () => {
    // `TIMESTAMP 'epoch'` gerçek tarih gibi işlenseydi "20000 gündür sessiz"
    // yazardı — panelde anlamsız ve alarm verici.
    queryRawMock.mockResolvedValue([satir({ sonHareket: new Date(0) })]);

    const [r] = await riskliOgrenciler();

    expect(r.sessizGun).toBeNull();
  });

  it("sessizlik gününü hesaplar", async () => {
    queryRawMock.mockResolvedValue([
      satir({ sonHareket: new Date(Date.now() - 14 * GUN_MS) }),
    ]);

    const [r] = await riskliOgrenciler();
    expect(r.sessizGun).toBe(14);
  });

  it("HİÇBİR sinyali olmayan öğrenciyi listeye ALMAZ", async () => {
    // Risk listesinin tamamı öğrenci olursa liste hiçbir şey söylemez.
    queryRawMock.mockResolvedValue([
      satir({ sonHareket: new Date(Date.now() - 1 * GUN_MS) }),
    ]);

    expect(await riskliOgrenciler()).toEqual([]);
  });

  it.each([
    ["sessizlik eşiği", { sonHareket: new Date(Date.now() - SESSIZLIK_GUN * GUN_MS) }],
    ["takılan adım", { sonHareket: new Date(), takilanAdim: BigInt(2) }],
    ["bekleyen soru", { sonHareket: new Date(), bekleyenSoru: true }],
  ])("%s tek başına listeye almaya yeter", async (_ad, ek) => {
    queryRawMock.mockResolvedValue([satir(ek)]);

    expect(await riskliOgrenciler()).toHaveLength(1);
  });

  it("takılan adım sayacını sayıya çevirir", async () => {
    queryRawMock.mockResolvedValue([satir({ takilanAdim: BigInt(3) })]);

    const [r] = await riskliOgrenciler();
    expect(r.takilanAdim).toBe(3);
    expect(typeof r.takilanAdim).toBe("number");
  });
});
