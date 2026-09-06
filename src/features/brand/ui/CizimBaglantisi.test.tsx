// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

/**
 * #285 — CTA çizim geçişi sözleşmesi.
 *
 * Buradaki risk animasyonun güzel görünmemesi değil; NAVİGASYONU BOZMASI.
 * Kırılgan noktalar:
 * - yeni sekmede açma (ctrl/cmd tık) kesinlikle engellenmemeli
 * - "hareketi azalt" diyen kullanıcı bekletilmemeli
 * - kullanıcı beklerken ayrılırsa zamanlayıcı arkadan yönlendirme yapmamalı
 */

const { itMock, hazirlaMock } = vi.hoisted(() => ({
  itMock: vi.fn(),
  hazirlaMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: itMock, prefetch: hazirlaMock }),
}));

import { CizimBaglantisi, CIZIM_SURESI_MS } from "./CizimBaglantisi";

function hareketAyari(azalt: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: azalt && q.includes("reduce"),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

const ciz = () =>
  render(
    <CizimBaglantisi href="/signup?rol=mentor" mesaj="Mentör başvurusu açılıyor...">
      Mentör ol
    </CizimBaglantisi>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  hareketAyari(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CizimBaglantisi — normal tık", () => {
  it("hemen gitmez; önce çizim gösterilir", () => {
    ciz();
    fireEvent.click(screen.getByText("Mentör ol"), { button: 0 });

    expect(itMock).not.toHaveBeenCalled();
    expect(screen.getByText("Mentör başvurusu açılıyor...")).toBeInTheDocument();
  });

  it("çizim bitince HEDEFE gidilir", () => {
    ciz();
    fireEvent.click(screen.getByText("Mentör ol"), { button: 0 });

    act(() => {
      vi.advanceTimersByTime(CIZIM_SURESI_MS);
    });

    expect(itMock).toHaveBeenCalledWith("/signup?rol=mentor");
  });

  it("bekleme 1-2 saniye aralığında kalır", () => {
    // Daha uzunu "takıldı" hissi verir, daha kısası çizimi yarıda keser.
    expect(CIZIM_SURESI_MS).toBeGreaterThanOrEqual(1000);
    expect(CIZIM_SURESI_MS).toBeLessThanOrEqual(2000);
  });

  it("perde açıkken hedef sayfa ÖNDEN hazırlanır", () => {
    ciz();
    fireEvent.click(screen.getByText("Mentör ol"), { button: 0 });

    expect(hazirlaMock).toHaveBeenCalledWith("/signup?rol=mentor");
  });
});

describe("CizimBaglantisi — araya girmemesi gereken durumlar", () => {
  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["orta tuş", { button: 1 }],
  ])("%s ile tıklamada geçişe KARIŞMAZ", (_ad, ek) => {
    ciz();
    fireEvent.click(screen.getByText("Mentör ol"), { button: 0, ...ek });

    expect(screen.queryByText("Mentör başvurusu açılıyor...")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(CIZIM_SURESI_MS * 2);
    });
    expect(itMock).not.toHaveBeenCalled();
  });

  it("hareketi azalt ayarında BEKLETİLMEZ", () => {
    hareketAyari(true);
    ciz();
    fireEvent.click(screen.getByText("Mentör ol"), { button: 0 });

    // Perde yok; tarayıcının kendi gezinmesi çalışır.
    expect(screen.queryByText("Mentör başvurusu açılıyor...")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(CIZIM_SURESI_MS * 2);
    });
    expect(itMock).not.toHaveBeenCalled();
  });
});

describe("CizimBaglantisi — temizlik", () => {
  it("beklerken ayrılan kullanıcı ARKADAN yönlendirilmez", () => {
    const { unmount } = ciz();
    fireEvent.click(screen.getByText("Mentör ol"), { button: 0 });

    unmount();
    act(() => {
      vi.advanceTimersByTime(CIZIM_SURESI_MS * 2);
    });

    expect(itMock).not.toHaveBeenCalled();
  });
});
