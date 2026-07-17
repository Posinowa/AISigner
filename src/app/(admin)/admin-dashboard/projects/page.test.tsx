// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import ProjectsPage from "./page";

describe("Admin projects — fetch fail error state (#123 / #89-3)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetch reddedilirse boş liste yerine error state render edilir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<ProjectsPage />);

    expect(await screen.findByText("Şablonlar yüklenemedi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tekrar dene/i })).toBeInTheDocument();
    // Boş duruma DÜŞMEDİĞİNİ doğrula (#89-3): hata görünümü ayrı.
    expect(screen.queryByText(/henüz şablon/i)).not.toBeInTheDocument();
  });

  it("'Tekrar Dene' fetch'i yeniden tetikler; başarılı olursa error state kalkar", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ProjectsPage />);

    const retry = await screen.findByRole("button", { name: /tekrar dene/i });
    fireEvent.click(retry);

    // İkinci istek başarılı ([]) → hata görünümü kaybolmalı.
    await vi.waitFor(() => {
      expect(screen.queryByText("Şablonlar yüklenemedi")).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
