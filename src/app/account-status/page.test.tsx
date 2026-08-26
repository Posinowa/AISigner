// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

/**
 * #250 — mentör başvurusu bu ekrana düşüyor (onay kapısı #249 ile mentörü de
 * kapsıyor). Mentörün dolduracağı bir STAJYER profili yok; "profilinizi
 * tamamlayın" yönlendirmesi ona gösterilmemeli — o rota mentöre kapalı.
 */

const { sessionMock, profileMock, redirectMock } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  profileMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next-auth", () => ({ getServerSession: sessionMock }));
vi.mock("@/lib/auth/nextauth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/db", () => ({
  prisma: { studentProfile: { findUnique: profileMock } },
}));
vi.mock("@/components/LogoutButton", () => ({
  default: () => <button>Çıkış Yap</button>,
}));

import AccountStatusPage from "./page";

async function ekran(role: string, accountStatus: string) {
  sessionMock.mockResolvedValue({
    user: { id: "k1", email: "kisi@ornek.com", role, accountStatus },
  });
  render(await AccountStatusPage());
}

beforeEach(() => {
  vi.clearAllMocks();
  profileMock.mockResolvedValue(null);
});

describe("account-status — mentör başvurusu (#250)", () => {
  it("bekleyen mentöre mentör metni gösterilir", async () => {
    await ekran("MENTOR", "PENDING");
    expect(screen.getByText("Mentör başvurunuz inceleniyor")).toBeInTheDocument();
  });

  it("mentöre 'profilinizi tamamlayın' denmez", async () => {
    await ekran("MENTOR", "PENDING");
    expect(screen.queryByText("Profilinizi tamamlayın")).toBeNull();
  });

  it("mentöre stajyer profil bağlantısı verilmez", async () => {
    // O rota mentöre kapalı; buton gösterilse kullanıcı geri sektirilirdi.
    await ekran("MENTOR", "PENDING");
    expect(document.querySelector('a[href="/profile-setup"]')).toBeNull();
  });

  it("mentör için stajyer profili sorgusu hiç atılmaz", async () => {
    await ekran("MENTOR", "PENDING");
    expect(profileMock).not.toHaveBeenCalled();
  });
});

describe("account-status — stajyer davranışı korunuyor (#250 regresyon)", () => {
  it("profilsiz stajyere profil tamamlama gösterilir", async () => {
    await ekran("STUDENT", "PENDING");
    expect(screen.getByText("Profilinizi tamamlayın")).toBeInTheDocument();
    expect(document.querySelector('a[href="/profile-setup"]')).not.toBeNull();
  });

  it("profili olan stajyere inceleme metni gösterilir", async () => {
    profileMock.mockResolvedValue({ id: "p1" });
    await ekran("STUDENT", "PENDING");
    expect(screen.getByText("Hesabınız inceleniyor")).toBeInTheDocument();
  });

  it("reddedilen hesaba red metni gösterilir", async () => {
    await ekran("STUDENT", "REJECTED");
    expect(screen.getByText("Başvurunuz reddedildi")).toBeInTheDocument();
  });
});
