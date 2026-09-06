// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { assignedProject: { findUnique: vi.fn() } },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { kodIncelemesiDurumu, guncelRizasiVarMi } from "./kod-incelemesi-durumu";
import { RIZA_METIN_SURUMU } from "./riza";

/**
 * #394 — Takımda AI kod incelemesi engellendiğinde kimse sebebini
 * öğrenemiyordu.
 *
 * ⚠️ KURAL DEĞİŞMİYOR. `pr-inceleme.ts` takım deposunda HERKESİN güncel
 * rızasını arıyor; ortak repoda kimin hangi satırı yazdığı bilinmiyor. Bu
 * modül yalnızca durumu GÖRÜNÜR yapıyor.
 */
const kullanici = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: id.toUpperCase(),
  lastName: null,
  email: `${id}@test.local`,
  aiConsentAt: new Date(),
  aiConsentVersion: RIZA_METIN_SURUMU,
  ...over,
});

const bireysel = (u: ReturnType<typeof kullanici>) => ({
  studentProfile: { user: u },
  team: null,
});
const takim = (...us: ReturnType<typeof kullanici>[]) => ({
  studentProfile: null,
  team: { members: us.map((u) => ({ studentProfile: { user: u } })) },
});

beforeEach(() => vi.clearAllMocks());

describe("guncelRizasiVarMi", () => {
  it("güncel sürüme rıza verilmişse true", () => {
    expect(
      guncelRizasiVarMi({ aiConsentAt: new Date(), aiConsentVersion: RIZA_METIN_SURUMU }),
    ).toBe(true);
  });

  /*
   * ⚠️ Kod incelemesi rızanın KAPSAMINI genişletti (#327): artık stajyerin
   * KODU da yurt dışına gidiyor. Eski metne rıza vermiş kullanıcı sohbetini
   * ve analizini kaybetmez, yalnız kod incelemesi almaz.
   */
  it("⚠️ ESKİ sürüme rıza yeterli DEĞİL (#327)", () => {
    expect(
      guncelRizasiVarMi({ aiConsentAt: new Date(), aiConsentVersion: "2025-01-v1" }),
    ).toBe(false);
  });

  it("hiç rıza yoksa false", () => {
    expect(guncelRizasiVarMi({ aiConsentAt: null, aiConsentVersion: RIZA_METIN_SURUMU })).toBe(
      false,
    );
  });
});

describe("kodIncelemesiDurumu", () => {
  it("bireysel atamada rıza varsa AÇIK", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(bireysel(kullanici("ali")));
    const d = await kodIncelemesiDurumu("ap-1");
    expect(d).toEqual({ acikMi: true, rizasiEksikler: [], sahipYok: false });
  });

  it("bireysel atamada rıza yoksa KAPALI ve kişi adlandırılır", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      bireysel(kullanici("ali", { aiConsentAt: null })),
    );
    const d = await kodIncelemesiDurumu("ap-1");
    expect(d.acikMi).toBe(false);
    expect(d.rizasiEksikler).toEqual([{ userId: "ali", ad: "ALI" }]);
  });

  it("takımda HERKESİN rızası varsa AÇIK", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      takim(kullanici("ali"), kullanici("veli")),
    );
    expect((await kodIncelemesiDurumu("ap-1")).acikMi).toBe(true);
  });

  /*
   * ⚠️ Tek bir eksik rıza tüm incelemeyi durdurur — davranışın kendisi,
   * #332'de bilinçli olarak böyle kurulmuştu.
   */
  it("⚠️ takımda TEK eksik rıza incelemeyi KAPATIR", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      takim(kullanici("ali"), kullanici("veli", { aiConsentAt: null })),
    );
    const d = await kodIncelemesiDurumu("ap-1");
    expect(d.acikMi).toBe(false);
    expect(d.rizasiEksikler.map((k) => k.userId)).toEqual(["veli"]);
  });

  it("birden çok eksik üye hepsi listelenir", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      takim(
        kullanici("ali", { aiConsentAt: null }),
        kullanici("veli"),
        kullanici("ayse", { aiConsentVersion: "eski" }),
      ),
    );
    const d = await kodIncelemesiDurumu("ap-1");
    expect(d.rizasiEksikler.map((k) => k.userId)).toEqual(["ali", "ayse"]);
  });

  it("⚠️ AYRILMIŞ üye sorulmaz — sorgu leftAt: null ile daraltılır (#332)", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(takim(kullanici("ali")));
    await kodIncelemesiDurumu("ap-1");
    const arg = prismaMock.assignedProject.findUnique.mock.calls[0][0];
    expect(arg.select.team.select.members.where).toEqual({ leftAt: null });
  });

  /*
   * ⚠️ Sahibi bulunamayan atamada inceleme KAPALI: dayanağı olmayan bir
   * rızayı varsaymak yerine kapalı kabul ediliyor (`atamaninAiRizasiVar` ile
   * aynı karar).
   */
  it("⚠️ sahibi olmayan atamada KAPALI, isim listelenmez", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      studentProfile: null,
      team: null,
    });
    const d = await kodIncelemesiDurumu("ap-1");
    expect(d).toEqual({ acikMi: false, rizasiEksikler: [], sahipYok: true });
  });

  it("olmayan atamada da KAPALI", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(null);
    expect((await kodIncelemesiDurumu("yok")).sahipYok).toBe(true);
  });

  it("adı olmayan üyede e-posta gösterilir", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      bireysel(kullanici("ali", { name: null, aiConsentAt: null })),
    );
    expect((await kodIncelemesiDurumu("ap-1")).rizasiEksikler[0].ad).toBe("ali@test.local");
  });
});
