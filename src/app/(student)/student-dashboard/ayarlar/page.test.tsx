// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

const { getServerSessionMock, redirectMock, prismaMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  redirectMock: vi.fn((yol: string) => {
    throw new Error(`REDIRECT:${yol}`);
  }),
  prismaMock: {
    studentProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({ getServerSession: getServerSessionMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/nextauth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/profile/ui/AvatarUpload", () => ({
  AvatarUpload: ({ ad }: { ad: string }) => <div data-testid="avatar-upload">{ad}</div>,
}));
vi.mock("@/features/radar/ui/TakilmaBildirimiAyari", () => ({
  TakilmaBildirimiAyari: ({ baslangic }: { baslangic: boolean }) => (
    <div data-testid="takilma-ayari">takilma:{String(baslangic)}</div>
  ),
}));

import StudentSettingsPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StudentSettingsPage (#538)", () => {
  it("oturum yoksa /signin'e yönlendirir", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(StudentSettingsPage()).rejects.toThrow("REDIRECT:/signin");
  });

  it("onaysız hesap durumunda (PENDING) durum ekranına yönlendirir", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "st-1", accountStatus: "PENDING", role: "STUDENT" },
    });

    await expect(StudentSettingsPage()).rejects.toThrow("REDIRECT:/account-status");
  });

  it("aktif öğrenci için profil fotoğrafı ve takılma ayarını render eder", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "st-1", name: "Ahmet Yılmaz", accountStatus: "APPROVED", role: "STUDENT", fotografVar: true },
    });
    prismaMock.studentProfile.findUnique.mockResolvedValue({ takilmaBildirimi: true });

    const jsx = await StudentSettingsPage();
    render(jsx);

    expect(screen.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeInTheDocument();
    expect(screen.getByTestId("avatar-upload")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-upload")).toHaveTextContent("Ahmet Yılmaz");
    expect(screen.getByTestId("takilma-ayari")).toHaveTextContent("takilma:true");
    expect(document.getElementById("profil")).toBeInTheDocument();
  });

  it("mezun öğrenci için takılma ayarı gizlenir, profil fotoğrafı açık kalır", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "st-2", name: "Mezun Ali", accountStatus: "GRADUATED", role: "STUDENT", fotografVar: false },
    });
    prismaMock.studentProfile.findUnique.mockResolvedValue({ takilmaBildirimi: false });

    const jsx = await StudentSettingsPage();
    render(jsx);

    expect(screen.getByTestId("avatar-upload")).toBeInTheDocument();
    expect(screen.queryByTestId("takilma-ayari")).not.toBeInTheDocument();
  });
});
