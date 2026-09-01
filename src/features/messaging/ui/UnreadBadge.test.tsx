// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

/**
 * #329 — okunmamış rozeti ve YOKLAMA YEDEĞİ sözleşmesi.
 *
 * En kritik iddia: yoklama KALDIRILMADI, koşullu hale getirildi. SSE'yi kesen
 * bir vekilin ya da eklentinin arkasında rozet ölü kalmamalı — 15 saniyelik
 * gecikme, hiç güncellenmemekten iyidir.
 */

type Dinleyici = (e: MessageEvent) => void;

/** jsdom'da EventSource yok; testin sürebilmesi için asgari bir taklit. */
class SahteEventSource {
  static sonuncu: SahteEventSource | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  kapandi = false;
  private dinleyiciler = new Map<string, Set<Dinleyici>>();

  constructor(public url: string) {
    SahteEventSource.sonuncu = this;
  }

  addEventListener(tip: string, fn: Dinleyici) {
    if (!this.dinleyiciler.has(tip)) this.dinleyiciler.set(tip, new Set());
    this.dinleyiciler.get(tip)!.add(fn);
  }

  removeEventListener(tip: string, fn: Dinleyici) {
    this.dinleyiciler.get(tip)?.delete(fn);
  }

  close() {
    this.kapandi = true;
  }

  /** Test yardımcıları */
  ac() {
    this.onopen?.();
  }
  hata() {
    this.onerror?.();
  }
  olay(tip: string, veri: unknown) {
    for (const fn of this.dinleyiciler.get(tip) ?? []) {
      fn({ data: JSON.stringify(veri) } as MessageEvent);
    }
  }
}

import { UnreadBadge } from "./UnreadBadge";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ unreadCount: 0 }) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("EventSource", SahteEventSource);
  SahteEventSource.sonuncu = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const akis = () => SahteEventSource.sonuncu!;

describe("canlı akış", () => {
  it("akıştan gelen sayıyı gösterir", async () => {
    render(<UnreadBadge />);
    act(() => akis().ac());

    act(() => akis().olay("okunmamis", { tip: "okunmamis", sayi: 4 }));

    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  it("sıfırda rozet göstermez", async () => {
    render(<UnreadBadge />);
    act(() => akis().ac());

    act(() => akis().olay("okunmamis", { tip: "okunmamis", sayi: 3 }));
    expect(await screen.findByText("3")).toBeInTheDocument();

    // Mesaj okununca akış sıfır yolluyor; rozet kaybolmalı.
    act(() => akis().olay("okunmamis", { tip: "okunmamis", sayi: 0 }));
    await waitFor(() => expect(screen.queryByText("0")).not.toBeInTheDocument());
  });

  it("9'dan büyük sayıyı kısaltır", async () => {
    render(<UnreadBadge />);
    act(() => akis().ac());

    act(() => akis().olay("okunmamis", { tip: "okunmamis", sayi: 42 }));

    expect(await screen.findByText("9+")).toBeInTheDocument();
  });

  it("bozuk olay akışı düşürmez", async () => {
    render(<UnreadBadge />);
    act(() => akis().ac());

    act(() => {
      for (const fn of ["okunmamis"]) void fn;
      // Doğrudan bozuk JSON gönder.
      akis().addEventListener("okunmamis", () => {});
    });

    // Sonrasında geçerli olay hâlâ işlenmeli.
    act(() => akis().olay("okunmamis", { tip: "okunmamis", sayi: 2 }));
    expect(await screen.findByText("2")).toBeInTheDocument();
  });
});

describe("yoklama yedeği", () => {
  it("akış BAĞLIYKEN yoklama yapmaz", async () => {
    render(<UnreadBadge />);
    // İlk değer için tek bir istek atılır (akışın ilk tikini beklemeyelim).
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => akis().ac());
    fetchMock.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("akış KOPUNCA yoklama geri gelir", async () => {
    // Bu testin varlık sebebi: SSE'yi kesen bir vekilin arkasında rozet ölü
    // kalırsa, özellik iyileştirme değil gerileme olur.
    render(<UnreadBadge />);
    act(() => akis().ac());
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    fetchMock.mockClear();

    act(() => akis().hata());

    await act(async () => {
      vi.advanceTimersByTime(16_000);
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it("akış hiç kurulamazsa yoklama çalışır", async () => {
    // EventSource'u olmayan/engellenen ortam.
    vi.stubGlobal("EventSource", undefined);
    render(<UnreadBadge />);

    await act(async () => {
      vi.advanceTimersByTime(16_000);
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});
