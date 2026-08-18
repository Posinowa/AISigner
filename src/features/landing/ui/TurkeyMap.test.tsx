// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { TurkeyMap } from "./TurkeyMap";
import { PROVINCES, SEED_PROVINCES } from "../data/tr-provinces";

/**
 * IntersectionObserver ve matchMedia jsdom'da yok; ikisini de kontrol
 * edilebilir şekilde sahteliyoruz. IO gözlemlenen öğeyi ANINDA kesişiyor
 * sayıyor — böylece animasyon render sonrası başlıyor.
 */
let azHareket = false;

function ioKur(anindaKesis = true) {
  class SahteIO {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) {
      if (anindaKesis) {
        this.cb(
          [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  vi.stubGlobal("IntersectionObserver", SahteIO);
}

beforeEach(() => {
  azHareket = false;
  vi.useFakeTimers();
  ioKur();
  vi.stubGlobal(
    "matchMedia",
    (q: string) =>
      ({
        matches: q.includes("reduced-motion") ? azHareket : false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ilerle = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const yanan = () =>
  document.querySelectorAll('[data-lit="true"]').length;
const belirenPin = () =>
  document.querySelectorAll('.landing-pin[data-on="true"]').length;

describe("TurkeyMap — render", () => {
  it("81 ilin tamamını çizer", () => {
    render(<TurkeyMap />);
    expect(document.querySelectorAll(".landing-prov")).toHaveLength(81);
  });

  it("her il erişilebilir bir başlık taşır", () => {
    render(<TurkeyMap />);
    const basliklar = [...document.querySelectorAll(".landing-prov title")].map(
      (t) => t.textContent,
    );
    expect(basliklar).toHaveLength(81);
    expect(basliklar).toContain("Ankara");
    expect(basliklar).toContain("Diyarbakır");
  });

  it("haritanın kendisi ekran okuyucuya tanımlıdır", () => {
    render(<TurkeyMap />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Türkiye haritası"),
    );
  });

  it("seed illeri için pin oluşturur", () => {
    render(<TurkeyMap />);
    expect(document.querySelectorAll(".landing-pin")).toHaveLength(
      SEED_PROVINCES.length,
    );
  });
});

describe("TurkeyMap — animasyon akışı", () => {
  it("başlangıçta hiçbir il boyanmamıştır", () => {
    render(<TurkeyMap />);
    expect(yanan()).toBe(0);
    expect(screen.getByText("00")).toBeInTheDocument();
  });

  it("ilk yanan il Ankara'dır", () => {
    render(<TurkeyMap />);
    ilerle(1600); // T_SEED0 = 1500
    const ilk = document.querySelector('[data-lit="true"]');
    expect(ilk?.getAttribute("data-il")).toBe("Ankara");
  });

  it("seed iller sırayla yanar, dalgadan önce biter", () => {
    render(<TurkeyMap />);
    ilerle(1500 + 360 * SEED_PROVINCES.length);
    expect(yanan()).toBe(SEED_PROVINCES.length);
    expect(belirenPin()).toBe(SEED_PROVINCES.length);
  });

  it("dalga tamamlanınca 81 ilin hepsi boyanır", () => {
    render(<TurkeyMap />);
    ilerle(30_000);
    expect(yanan()).toBe(81);
    expect(screen.getByText("81")).toBeInTheDocument();
  });

  it("sayaç gerçekten boyanan il sayısını gösterir", () => {
    render(<TurkeyMap />);
    ilerle(1500 + 360 * 4);
    const dom = Number(
      screen.getByText(/^\d{2}$/).textContent,
    );
    expect(dom).toBe(yanan());
  });
});

describe("TurkeyMap — tekrar oynat", () => {
  it("sayacı ve boyalı illeri sıfırlar", async () => {
    render(<TurkeyMap />);
    ilerle(30_000);
    expect(yanan()).toBe(81);

    act(() => {
      screen.getByRole("button", { name: /tekrar oynat/i }).click();
    });
    expect(yanan()).toBe(0);
    expect(screen.getByText("00")).toBeInTheDocument();
  });

  it("üst üste basmak zamanlayıcıları çakıştırmaz", () => {
    render(<TurkeyMap />);
    const btn = screen.getByRole("button", { name: /tekrar oynat/i });

    ilerle(3000);
    act(() => btn.click());
    ilerle(500);
    act(() => btn.click());
    ilerle(500);
    act(() => btn.click());

    // eski turlardan artakalan zamanlayıcı olsaydı sayaç DOM ile tutmazdı
    ilerle(30_000);
    expect(yanan()).toBe(81);
    expect(screen.getByText("81")).toBeInTheDocument();
  });
});

describe("TurkeyMap — hareket azaltma", () => {
  it("bitmiş haritayı gözlemciyi beklemeden gösterir", () => {
    azHareket = true;
    ioKur(false); // IO hiç tetiklenmesin
    render(<TurkeyMap />);

    // hiç zaman ilerletmeden bitmiş olmalı
    expect(yanan()).toBe(81);
    expect(belirenPin()).toBe(SEED_PROVINCES.length);
    expect(screen.getByText("81")).toBeInTheDocument();
  });
});

describe("TurkeyMap — veri tutarlılığı", () => {
  it("çizilen il adları veri kaynağıyla birebir aynıdır", () => {
    render(<TurkeyMap />);
    const cizilen = [...document.querySelectorAll(".landing-prov")]
      .map((p) => p.getAttribute("data-il"))
      .sort();
    const beklenen = PROVINCES.map((p) => p.name).sort();
    expect(cizilen).toEqual(beklenen);
  });
});
