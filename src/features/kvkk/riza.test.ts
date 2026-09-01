import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  aiRizasiVar,
  profilSahibininRizasiVar,
  aiRizasiniAyarla,
  RIZA_METIN_SURUMU,
} from "./riza";

beforeEach(() => vi.clearAllMocks());

describe("aiRizasiVar", () => {
  it("tarih varsa rıza VAR", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ aiConsentAt: new Date() });
    expect(await aiRizasiVar("u1")).toBe(true);
  });

  it("tarih null ise rıza YOK", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ aiConsentAt: null });
    expect(await aiRizasiVar("u1")).toBe(false);
  });

  it("kullanıcı bulunamazsa rıza YOK (varsayılan güvenli taraf)", async () => {
    // Eksik kayıtta "rıza var" varsaymak, veriyi izinsiz yurt dışına çıkarmak olurdu.
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await aiRizasiVar("yok")).toBe(false);
  });
});

describe("profilSahibininRizasiVar", () => {
  // Mentörün tetiklediği AI işlemlerinde veri ÖĞRENCİYE ait; rıza da onun.
  it("öğrencinin rızası varsa true", async () => {
    prismaMock.studentProfile.findUnique.mockResolvedValue({
      user: { aiConsentAt: new Date() },
    });
    expect(await profilSahibininRizasiVar("p1")).toBe(true);
  });

  it("öğrencinin rızası yoksa false", async () => {
    prismaMock.studentProfile.findUnique.mockResolvedValue({ user: { aiConsentAt: null } });
    expect(await profilSahibininRizasiVar("p1")).toBe(false);
  });

  it("profil bulunamazsa false", async () => {
    prismaMock.studentProfile.findUnique.mockResolvedValue(null);
    expect(await profilSahibininRizasiVar("yok")).toBe(false);
  });
});

describe("aiRizasiniAyarla", () => {
  it("rıza verilince tarih ve METİN SÜRÜMÜ kaydedilir", async () => {
    // Metin değişirse eski rıza yeni metni kapsamaz; hangi sürüme onay
    // verildiği ispat için gerekli.
    await aiRizasiniAyarla("u1", true);

    const cagri = prismaMock.user.update.mock.calls[0]![0];
    expect(cagri.where).toEqual({ id: "u1" });
    expect(cagri.data.aiConsentAt).toBeInstanceOf(Date);
    expect(cagri.data.aiConsentVersion).toBe(RIZA_METIN_SURUMU);
  });

  it("rıza GERİ ALININCA tarih ve sürüm temizlenir", async () => {
    // KVKK m.11: rıza geri alınabilir olmalı.
    await aiRizasiniAyarla("u1", false);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { aiConsentAt: null, aiConsentVersion: null },
    });
  });
});
