// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, act, cleanup } from "@testing-library/react";

/**
 * #358 — bağlantı SEKME başına tek, BİLEŞEN başına değil.
 *
 * Önceden her `useCanliAkis` çağrısı kendi `EventSource`'unu kuruyordu ve
 * mount yerleri örtüştüğü için tek sayfada 2–3 kalıcı bağlantı açılıyordu.
 * #329'un gerekçesi "maliyet kullanıcı sayısından bağımsız" idi; bu onu
 * doğrudan aşındırıyordu.
 */

type Dinleyici = (e: MessageEvent) => void;

class SahteEventSource {
  static ornekler: SahteEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  kapandi = false;
  private dinleyiciler = new Map<string, Set<Dinleyici>>();

  constructor(public url: string) {
    SahteEventSource.ornekler.push(this);
  }
  addEventListener(t: string, fn: Dinleyici) {
    if (!this.dinleyiciler.has(t)) this.dinleyiciler.set(t, new Set());
    this.dinleyiciler.get(t)!.add(fn);
  }
  removeEventListener(t: string, fn: Dinleyici) {
    this.dinleyiciler.get(t)?.delete(fn);
  }
  close() {
    this.kapandi = true;
  }
  ac() {
    this.onopen?.();
  }
  hata() {
    this.onerror?.();
  }
  olay(t: string, veri: unknown) {
    for (const fn of this.dinleyiciler.get(t) ?? []) {
      fn({ data: JSON.stringify(veri) } as MessageEvent);
    }
  }
  bozukOlay(t: string) {
    for (const fn of this.dinleyiciler.get(t) ?? []) {
      fn({ data: "{bu json degil" } as MessageEvent);
    }
  }
}

import { useCanliAkis, canliAkisiSifirlaForTests, type CanliOlay } from "./useCanliAkis";

/** Kancayı kullanan asgari bileşen. */
function Tuketici({ al }: { al: (o: CanliOlay) => void }) {
  const { bagli } = useCanliAkis(al);
  return <span data-testid="durum">{bagli ? "bagli" : "kopuk"}</span>;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  SahteEventSource.ornekler = [];
  vi.stubGlobal("EventSource", SahteEventSource);
  canliAkisiSifirlaForTests();
});

afterEach(() => {
  cleanup();
  canliAkisiSifirlaForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const akis = () => SahteEventSource.ornekler.at(-1)!;

describe("tek bağlantı (#358)", () => {
  it("üç tüketici TEK bağlantı açar", () => {
    // Öğrenci mesajlar sayfasının gerçek hâli: UnreadBadge + AdimKutlamasi +
    // MessagingPanel. Öncesinde bu 3 ayrı SSE bağlantısıydı.
    render(
      <>
        <Tuketici al={() => {}} />
        <Tuketici al={() => {}} />
        <Tuketici al={() => {}} />
      </>,
    );

    expect(SahteEventSource.ornekler).toHaveLength(1);
  });

  it("olayı TÜM tüketicilere dağıtır", () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <>
        <Tuketici al={a} />
        <Tuketici al={b} />
      </>,
    );

    act(() => akis().olay("okunmamis", { tip: "okunmamis", sayi: 5 }));

    expect(a).toHaveBeenCalledWith({ tip: "okunmamis", sayi: 5 });
    expect(b).toHaveBeenCalledWith({ tip: "okunmamis", sayi: 5 });
  });

  it("bağlantı durumunu tüm tüketicilere yansıtır", () => {
    const { getAllByTestId } = render(
      <>
        <Tuketici al={() => {}} />
        <Tuketici al={() => {}} />
      </>,
    );

    act(() => akis().ac());

    for (const el of getAllByTestId("durum")) expect(el).toHaveTextContent("bagli");
  });

  it("hata durumunda TÜM tüketiciler 'kopuk'a döner", () => {
    // Yoklama yedeğini tetikleyen sinyal bu; paylaşımlı bağlantıda bir
    // tüketicinin bunu kaçırması, onun yoklamayı hiç başlatmaması demekti.
    const { getAllByTestId } = render(
      <>
        <Tuketici al={() => {}} />
        <Tuketici al={() => {}} />
      </>,
    );
    act(() => akis().ac());
    for (const el of getAllByTestId("durum")) expect(el).toHaveTextContent("bagli");

    act(() => akis().hata());

    for (const el of getAllByTestId("durum")) expect(el).toHaveTextContent("kopuk");
  });

  it("sonradan katılan tüketici AÇIK bağlantının durumunu görür", () => {
    // Açılış olayı çoktan geçmiş olur; yeni abone "kopuk" sanıp gereksiz
    // yoklama başlatmamalı.
    const { rerender } = render(<Tuketici al={() => {}} />);
    act(() => akis().ac());

    rerender(
      <>
        <Tuketici al={() => {}} />
        <Tuketici al={() => {}} />
      </>,
    );

    expect(SahteEventSource.ornekler).toHaveLength(1);
    const { getAllByTestId } = render(<Tuketici al={() => {}} />);
    expect(getAllByTestId("durum").at(-1)).toHaveTextContent("bagli");
  });
});

describe("yaşam döngüsü", () => {
  it("bir tüketici ayrılınca bağlantı KAPANMAZ", () => {
    const { unmount } = render(<Tuketici al={() => {}} />);
    render(<Tuketici al={() => {}} />);

    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(akis().kapandi).toBe(false);
  });

  it("son tüketici ayrılınca GECİKMELİ kapanır", () => {
    const { unmount } = render(<Tuketici al={() => {}} />);

    unmount();
    // Gecikme dolmadan kapanmamalı.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(akis().kapandi).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(akis().kapandi).toBe(true);
  });

  it("sayfa geçişinde bağlantıyı yeniden KURMAZ", () => {
    // Next.js istemci-taraflı gezinmede unmount/mount çifti oluşur. Gecikme
    // olmasaydı her geçiş bağlantıyı kapatıp yeniden açardı.
    const { unmount } = render(<Tuketici al={() => {}} />);
    unmount();
    render(<Tuketici al={() => {}} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(SahteEventSource.ornekler).toHaveLength(1);
    expect(akis().kapandi).toBe(false);
  });
});

describe("dayanıklılık", () => {
  it("bozuk olay diğer tüketicileri etkilemez", () => {
    const a = vi.fn();
    render(
      <>
        <Tuketici al={a} />
        <Tuketici al={() => {}} />
      </>,
    );

    act(() => akis().bozukOlay("mesaj"));
    act(() => akis().olay("okunmamis", { tip: "okunmamis", sayi: 1 }));

    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith({ tip: "okunmamis", sayi: 1 });
  });

  it("bir tüketicinin hatası diğerini engellemez", () => {
    const saglam = vi.fn();
    render(
      <>
        <Tuketici
          al={() => {
            throw new Error("tüketici patladı");
          }}
        />
        <Tuketici al={saglam} />
      </>,
    );

    act(() => akis().olay("okunmamis", { tip: "okunmamis", sayi: 2 }));

    expect(saglam).toHaveBeenCalledWith({ tip: "okunmamis", sayi: 2 });
  });

  it("EventSource yoksa çökmez ve 'kopuk' kalır", () => {
    vi.stubGlobal("EventSource", undefined);

    const { getByTestId } = render(<Tuketici al={() => {}} />);

    expect(getByTestId("durum")).toHaveTextContent("kopuk");
  });
});
