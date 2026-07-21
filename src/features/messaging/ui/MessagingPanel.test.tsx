// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessagingPanel } from "./MessagingPanel";

// Panel görünürlük-farkında polling kullanıyor (#98); testlerde zamanlayıcı
// tetiklenmesin diye sahte zamanlayıcıya gerek yok — sadece ilk yükleme incelenir.

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MessagingPanel — konuşma yükleme hatası (#126-6 / #97)", () => {
  it("konuşmalar isteği reddedilirse error UI + retry gösterilir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<MessagingPanel currentUserId="user-1" />);

    expect(await screen.findByText("Konuşmalar yüklenemedi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tekrar dene/i })).toBeInTheDocument();
  });

  it("istek ok=false dönerse de error UI gösterilir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    render(<MessagingPanel currentUserId="user-1" />);

    expect(await screen.findByText("Konuşmalar yüklenemedi.")).toBeInTheDocument();
  });

  it("'Tekrar Dene' yeniden istek atar; başarılı olursa hata kalkar", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({ ok: true, json: async () => ({ conversations: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<MessagingPanel currentUserId="user-1" />);

    const retry = await screen.findByRole("button", { name: /tekrar dene/i });
    fireEvent.click(retry);

    await vi.waitFor(() => {
      expect(screen.queryByText("Konuşmalar yüklenemedi.")).not.toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it("hata durumu 'hiç konuşma yok' boş durumundan ayrıdır", async () => {
    // Başarılı ama boş liste → hata metni GÖRÜNMEMELİ (#89-3 ayrımı).
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ conversations: [] }) }),
    );

    render(<MessagingPanel currentUserId="user-1" />);

    await vi.waitFor(() => {
      expect(screen.queryByText("Konuşmalar yüklenemedi.")).not.toBeInTheDocument();
    });
  });
});
