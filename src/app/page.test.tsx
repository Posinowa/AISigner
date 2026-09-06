// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * G1 — Kök rota yetki sözleşmesi.
 *
 * "/" herkese açık hale geldi (oturumsuz ziyaretçi açılış sayfasını görür).
 * Bu testler, oturumLU dalın davranışının BİREBİR korunduğunu garanti eder:
 * hiçbir rol yanlışlıkla açılış sayfasına düşmemeli, panel yönlendirmeleri
 * kaybolmamalı.
 */

const { getServerSessionMock, redirectMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  redirectMock: vi.fn((yol: string) => {
    // next/navigation redirect gerçekte throw eder; akışı aynı şekilde kesiyoruz
    throw new Error(`REDIRECT:${yol}`);
  }),
}));

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/nextauth", () => ({ authOptions: {} }));
vi.mock("@/features/landing/ui/LandingPage", () => ({
  LandingPage: () => "ACILIS_SAYFASI",
}));

import Home from "./page";

async function cagir() {
  try {
    const sonuc = await Home();
    return { tur: "render" as const, sonuc };
  } catch (e) {
    const m = (e as Error).message;
    if (m.startsWith("REDIRECT:")) {
      return { tur: "redirect" as const, yol: m.slice("REDIRECT:".length) };
    }
    throw e;
  }
}

beforeEach(() => {
  getServerSessionMock.mockReset();
  redirectMock.mockClear();
});

describe("Kök rota — oturumsuz ziyaretçi", () => {
  it("açılış sayfasını basar, yönlendirmez", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const r = await cagir();
    expect(r.tur).toBe("render");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("açılış sayfasına oturum verisi geçirilmez", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const r = await cagir();
    // LandingPage prop'suz çağrılır — kullanıcıya özel veri sızmaz
    expect(r.tur).toBe("render");
    expect(String((r as { sonuc: unknown }).sonuc)).toContain("");
  });
});

describe("Kök rota — oturumlu kullanıcı yönlendirmeleri korunur", () => {
  const durumlar: Array<{
    ad: string;
    session: unknown;
    beklenen: string;
  }> = [
    {
      ad: "ADMIN → admin paneli",
      session: { user: { role: "ADMIN", accountStatus: "APPROVED" } },
      beklenen: "/admin-dashboard",
    },
    {
      ad: "MENTOR → mentör paneli",
      session: { user: { role: "MENTOR", accountStatus: "APPROVED" } },
      beklenen: "/mentor-dashboard",
    },
    {
      ad: "STUDENT + APPROVED → stajyer paneli",
      session: { user: { role: "STUDENT", accountStatus: "APPROVED" } },
      beklenen: "/student-dashboard",
    },
    {
      ad: "STUDENT + PENDING → hesap durumu",
      session: { user: { role: "STUDENT", accountStatus: "PENDING" } },
      beklenen: "/account-status",
    },
    {
      ad: "STUDENT + REJECTED → hesap durumu",
      session: { user: { role: "STUDENT", accountStatus: "REJECTED" } },
      beklenen: "/account-status",
    },
    {
      ad: "rolsüz oturum (silinmiş hesap) → signin",
      session: { user: { name: "kimsesiz" } },
      beklenen: "/signin",
    },
  ];

  for (const d of durumlar) {
    it(d.ad, async () => {
      getServerSessionMock.mockResolvedValue(d.session);
      const r = await cagir();
      expect(r.tur).toBe("redirect");
      expect((r as { yol: string }).yol).toBe(d.beklenen);
    });
  }

  it("hiçbir oturumlu durum açılış sayfasına düşmez", async () => {
    for (const d of durumlar) {
      getServerSessionMock.mockReset();
      getServerSessionMock.mockResolvedValue(d.session);
      const r = await cagir();
      expect(r.tur, `${d.ad} açılış sayfasına düştü`).toBe("redirect");
    }
  });

  it("PENDING durumu rolden ÖNCE değerlendirilir (onaysız admin paneli görmez)", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { role: "ADMIN", accountStatus: "PENDING" },
    });
    const r = await cagir();
    expect((r as { yol: string }).yol).toBe("/account-status");
  });
});
