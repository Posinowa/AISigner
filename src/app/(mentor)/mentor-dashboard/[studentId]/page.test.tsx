// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

// Sayfa useParams/useSearchParams kullanıyor — jsdom'da router yok.
vi.mock("next/navigation", () => ({
  useParams: () => ({ studentId: "student-1" }),
  useSearchParams: () => new URLSearchParams(""),
}));

import StudentDetailPage from "./page";

function renderPage() {
  return render(
    <ConfirmDialogProvider>
      <StudentDetailPage />
    </ConfirmDialogProvider>,
  );
}

const student = {
  id: "student-1",
  name: "Ali",
  lastName: "Veli",
  email: "ali@test.com",
  studentProfile: {
    id: "p1",
    birthYear: 2000,
    experienceLevel: "BEGINNER",
    interests: ["React"],
    goals: null,
    availability: null,
    assignedProjects: [],
    profileAnalysis: null,
  },
};

describe("Mentör öğrenci detayı — hata durumları (#159)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("ağ hatasında 'Öğrenci bulunamadı' DEĞİL, hata ekranı gösterilir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    renderPage();

    expect(await screen.findByText("Öğrenci bilgileri yüklenemedi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tekrar dene/i })).toBeInTheDocument();
    // Asıl regresyon: ağ hatası "bu öğrenci yok" gibi gösterilmemeli
    expect(screen.queryByText("Öğrenci bulunamadı")).not.toBeInTheDocument();
  });

  it("sunucu 500 dönerse de hata ekranı gösterilir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    renderPage();

    expect(await screen.findByText("Öğrenci bilgileri yüklenemedi")).toBeInTheDocument();
    expect(screen.queryByText("Öğrenci bulunamadı")).not.toBeInTheDocument();
  });

  it("404 gerçekten 'bulunamadı' ekranını gösterir — hata ekranını değil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }),
    );

    renderPage();

    expect(await screen.findByText("Öğrenci bulunamadı")).toBeInTheDocument();
    expect(screen.queryByText("Öğrenci bilgileri yüklenemedi")).not.toBeInTheDocument();
  });

  it("'Tekrar Dene' isteği yeniden atar; başarılı olursa hata ekranı kalkar", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ ok: true, json: async () => student });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /tekrar dene/i }));

    expect(await screen.findByText("ali@test.com")).toBeInTheDocument();
    expect(screen.queryByText("Öğrenci bilgileri yüklenemedi")).not.toBeInTheDocument();
  });

  it("başarılı yüklemede öğrenci bilgileri render edilir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => student }),
    );

    renderPage();

    expect(await screen.findByText("ali@test.com")).toBeInTheDocument();
  });
});
