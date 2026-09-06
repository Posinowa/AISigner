// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import { AdimKutlamasi } from "./AdimKutlamasi";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

let mockOlayHandler: ((olay: { tip: string; stepId?: string; baslik?: string }) => void) | null = null;

vi.mock("@/features/messaging/ui/useCanliAkis", () => ({
  useCanliAkis: (onOlay: (olay: { tip: string; stepId?: string; baslik?: string }) => void) => {
    mockOlayHandler = onOlay;
    return { bagli: true };
  },
}));

describe("AdimKutlamasi (#329)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockOlayHandler = null;
    refreshMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("başlangıçta hiçbir şey render etmez", () => {
    render(<AdimKutlamasi />);
    expect(screen.queryByText(/Adım tamamlandı/i)).not.toBeInTheDocument();
  });

  it("adim-tamamlandi olayı geldiğinde kutlama gösterir ve süre bitince sayfayı tazeler", () => {
    render(<AdimKutlamasi />);

    act(() => {
      mockOlayHandler?.({
        tip: "adim-tamamlandi",
        stepId: "step-1",
        baslik: "Veritabanı Şeması",
      });
    });

    expect(screen.getByText("Adım tamamlandı 🎉")).toBeInTheDocument();
    expect(screen.getByText("Veritabanı Şeması")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.queryByText("Adım tamamlandı 🎉")).not.toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("arka arkaya iki tamamlama: ilk zamanlayıcı İKİNCİ kutlamayı kapatmaz", () => {
    // #358: Önceden her olay yeni bir setTimeout kuruyor, hiçbiri iptal
    // edilmiyordu. İlk zamanlayıcı ateşleyince ikinci kutlama erken kapanıyor
    // ve router.refresh() iki kez koşuyordu.
    render(<AdimKutlamasi />);

    act(() => mockOlayHandler!({ tip: "adim-tamamlandi", stepId: "s1", baslik: "Birinci adım" }));
    // İlk kutlamanın süresi dolmadan ikincisi gelsin.
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => mockOlayHandler!({ tip: "adim-tamamlandi", stepId: "s2", baslik: "İkinci adım" }));

    // İlk zamanlayıcının ateşleyeceği ana kadar ilerle.
    act(() => { vi.advanceTimersByTime(2000); });

    // İkinci kutlama HÂLÂ ekranda olmalı ve tazeleme henüz koşmamalı.
    expect(screen.getByText("İkinci adım")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();

    // İkincinin kendi süresi dolunca kapanır ve TEK kez tazelenir.
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText("İkinci adım")).not.toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("unmount sonrası başıboş tazeleme ateşlenmez", () => {
    const { unmount } = render(<AdimKutlamasi />);
    act(() => mockOlayHandler!({ tip: "adim-tamamlandi", stepId: "s1", baslik: "Adım" }));

    unmount();
    act(() => { vi.advanceTimersByTime(10_000); });

    expect(refreshMock).not.toHaveBeenCalled();
  });
});
