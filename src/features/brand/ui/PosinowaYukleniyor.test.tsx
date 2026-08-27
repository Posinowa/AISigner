// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PosinowaYukleniyor } from "./PosinowaYukleniyor";

/**
 * #285 — bekleme göstergesi sözleşmesi.
 *
 * En kritik iki nokta:
 * - aynı sayfada birden fazla örnek olabilir; maske kimlikleri ÇAKIŞMAMALI,
 *   yoksa ikinci örnek birincinin maskesini kullanır ve yarıklar kayar
 * - yanında zaten metin varsa gösterge ekran okuyucuya İKİ KEZ duyurulmamalı
 */

describe("PosinowaYukleniyor — maske kimliği", () => {
  it("iki örnek FARKLI maske kimliği kullanır", () => {
    const { container } = render(
      <>
        <PosinowaYukleniyor />
        <PosinowaYukleniyor />
      </>,
    );

    const kimlikler = [...container.querySelectorAll("mask")].map((m) => m.id);

    expect(kimlikler).toHaveLength(2);
    expect(new Set(kimlikler).size, "kimlikler benzersiz olmalı").toBe(2);
  });

  it("grup kendi maskesine işaret eder", () => {
    const { container } = render(<PosinowaYukleniyor />);

    const maskeId = container.querySelector("mask")?.id;
    const grup = container.querySelector("g");

    expect(maskeId).toBeTruthy();
    expect(grup?.getAttribute("mask")).toBe(`url(#${maskeId})`);
  });
});

describe("PosinowaYukleniyor — erişilebilirlik", () => {
  it("tek başına kullanıldığında durum olarak duyurulur", () => {
    render(<PosinowaYukleniyor etiket="Yükleniyor" />);
    expect(screen.getByRole("status", { name: "Yükleniyor" })).toBeInTheDocument();
  });

  it("dekoratif kullanımda ekran okuyucudan GİZLENİR", () => {
    // Yanında zaten "Giriş yapılıyor..." metni var; iki kez duyurulmamalı.
    const { container } = render(<PosinowaYukleniyor dekoratif />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("role")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("PosinowaYukleniyor — çizim", () => {
  it("kalem yolu tam uzunlukta dash deseni taşır", () => {
    // Desen yol uzunluğuyla eşleşmezse çizim yarım kalır veya sıçrar.
    const { container } = render(<PosinowaYukleniyor />);
    const kalem = container.querySelector(".posinowa-kalem");

    expect(kalem?.getAttribute("stroke-dasharray")).toBe("2460 2460");
  });

  it("şekil bekleme boyunca okunur kalsın diye hayalet katman vardır", () => {
    const { container } = render(<PosinowaYukleniyor />);
    const yollar = container.querySelectorAll("path");

    expect(yollar).toHaveLength(2);
    expect(yollar[0].getAttribute("opacity")).toBe("0.15");
  });

  it("her iki yol da AYNI şekli çizer", () => {
    const { container } = render(<PosinowaYukleniyor />);
    const [hayalet, kalem] = container.querySelectorAll("path");

    expect(hayalet.getAttribute("d")).toBe(kalem.getAttribute("d"));
  });

  it("renk currentColor'dan gelir — bağlamına uyum sağlar", () => {
    const { container } = render(<PosinowaYukleniyor />);
    expect(container.querySelector("g")?.getAttribute("stroke")).toBe("currentColor");
  });

  it("boyut oranı korunur (511x482)", () => {
    const { container } = render(<PosinowaYukleniyor boyut={100} />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("width")).toBe("100");
    expect(svg?.getAttribute("height")).toBe("94"); // 100 * 482/511
  });
});
