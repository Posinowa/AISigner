// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * `atamaninAiRizasiVar` (#389).
 *
 * ⚠️ Bu fonksiyon var çünkü rıza kontrolü bugüne kadar her AI çağrısının
 * YANINA elle yazıldı ve DÖRT kez atlandı (#321 kurdu, #352 mentör
 * başvurusunu, #389 GitHub kurulumunu ve ai-step ucunu kapattı).
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { assignedProject: { findUnique: vi.fn() } },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { atamaninAiRizasiVar } from "./riza";

const rizali = (tarih: Date | null) => ({ user: { aiConsentAt: tarih } });
const T = new Date("2026-01-01");

beforeEach(() => vi.clearAllMocks());

describe("bireysel atama", () => {
  it("rıza varsa true", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      studentProfile: rizali(T),
      team: null,
    });
    expect(await atamaninAiRizasiVar("ap-1")).toBe(true);
  });

  it("rıza yoksa false", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      studentProfile: rizali(null),
      team: null,
    });
    expect(await atamaninAiRizasiVar("ap-1")).toBe(false);
  });
});

describe("takım ataması", () => {
  it("HERKESİN rızası varsa true", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      studentProfile: null,
      team: { members: [{ studentProfile: rizali(T) }, { studentProfile: rizali(T) }] },
    });
    expect(await atamaninAiRizasiVar("ap-1")).toBe(true);
  });

  it("⚠️ TEK ÜYE eksikse false — içerik ORTAK panoya yazılıyor", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      studentProfile: null,
      team: { members: [{ studentProfile: rizali(T) }, { studentProfile: rizali(null) }] },
    });
    expect(await atamaninAiRizasiVar("ap-1")).toBe(false);
  });

  it("AYRILMIŞ üyenin rızası aranmaz — sorgu leftAt ile daraltılır", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      studentProfile: null,
      team: { members: [{ studentProfile: rizali(T) }] },
    });
    await atamaninAiRizasiVar("ap-1");

    const select = prismaMock.assignedProject.findUnique.mock.calls[0][0].select;
    expect(select.team.select.members.where.leftAt).toBeNull();
  });

  it("takımda hiç aktif üye yoksa false — dayanaksız rıza VARSAYILMAZ", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      studentProfile: null,
      team: { members: [] },
    });
    expect(await atamaninAiRizasiVar("ap-1")).toBe(false);
  });
});

describe("kenar durumlar", () => {
  it("olmayan atama → false", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(null);
    expect(await atamaninAiRizasiVar("yok")).toBe(false);
  });

  it("sahipsiz atama → false", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue({
      studentProfile: null,
      team: null,
    });
    expect(await atamaninAiRizasiVar("ap-1")).toBe(false);
  });
});
