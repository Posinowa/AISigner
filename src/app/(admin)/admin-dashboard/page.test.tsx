// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

// Sayfa next-auth/UnreadBadge gibi tarayıcı-dışı bağımlılıklar içeriyor; render
// testinin odağı hata durumu olduğundan bunlar sadeleştirilir.
vi.mock("@/features/messaging/ui/UnreadBadge", () => ({ UnreadBadge: () => null }));
vi.mock("@/components/LogoutButton", () => ({ default: () => null }));

import AdminDashboard from "./page";

function renderPage() {
  return render(
    <ConfirmDialogProvider>
      <AdminDashboard />
    </ConfirmDialogProvider>,
  );
}

describe("Admin dashboard — fetch fail error state (#126-6 / #89-3)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("kullanıcı listesi isteği reddedilirse boş liste yerine error state render edilir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    renderPage();

    expect(await screen.findByText("Kullanıcılar yüklenemedi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tekrar dene/i })).toBeInTheDocument();
  });

  it("istek 500 dönerse de error state gösterilir (ok=false dalı)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    renderPage();

    expect(await screen.findByText("Kullanıcılar yüklenemedi")).toBeInTheDocument();
  });

  it("'Tekrar Dene' yeniden istek atar; başarılı olursa error state kalkar", async () => {
    const ok = { ok: true, json: async () => [] };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down")) // users
      .mockRejectedValueOnce(new Error("down")) // mentors
      .mockResolvedValue(ok); // retry sonrası tümü
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    const retry = await screen.findByRole("button", { name: /tekrar dene/i });
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(retry);

    await vi.waitFor(() => {
      expect(screen.queryByText("Kullanıcılar yüklenemedi")).not.toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
