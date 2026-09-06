// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PosinowaYukleniyor } from "./PosinowaYukleniyor";

/**
 * #285 — bekleme göstergesi sözleşmesi.
 *
 * Gösterge logonun DIŞ HATTINI çiziyor; içi boş kalmalı. Kırılgan olan iki yer:
 * - yol uzunluğu üç yerde tutarlı olmalı (dasharray, CSS değişkeni, keyframes),
 *   yoksa çizim yarım kalır veya döngü sıçrar
 * - yanında zaten metin varsa gösterge ekran okuyucuya İKİ KEZ duyurulmamalı
 */

const svgAl = (c: HTMLElement) => c.querySelector("svg")!;

describe("PosinowaYukleniyor — çizim", () => {
  it("hat DOLDURULMAZ; yalnızca çizgi olarak çizilir", () => {
    // Asıl kusur buydu: dolu/kalın çizim logoyu siyah bir damgaya çeviriyordu.
    const { container } = render(<PosinowaYukleniyor />);
    const g = container.querySelector("g");

    expect(g?.getAttribute("fill")).toBe("none");
    expect(g?.getAttribute("stroke")).toBe("currentColor");
  });

  it("çizgi, şeklin kendi kalınlığından belirgin biçimde İNCE kalır", () => {
    // Logonun en ince kolu 41 birim. Çizgi ona yaklaşırsa içi kapanır.
    const { container } = render(<PosinowaYukleniyor />);
    const kalinlik = Number(container.querySelector("g")?.getAttribute("stroke-width"));

    expect(kalinlik).toBeLessThan(41 / 2);
    expect(kalinlik).toBeGreaterThan(0);
  });

  it("dasharray ile CSS değişkeni AYNI uzunluğu söyler", () => {
    // Keyframes dashoffset'i --pn-uzunluk'tan okuyor. İkisi ayrışırsa
    // animasyon ya erken biter ya da ortada asılı kalır.
    const { container } = render(<PosinowaYukleniyor />);
    const svg = svgAl(container);
    const kalem = container.querySelector(".posinowa-kalem");

    const degisken = svg.style.getPropertyValue("--pn-uzunluk").trim();
    expect(degisken).not.toBe("");
    expect(kalem?.getAttribute("stroke-dasharray")).toBe(`${degisken} ${degisken}`);
  });

  it("logo İKİ ayrı kapalı halkadan oluşur — diyagonal boşluklar buradan gelir", () => {
    const { container } = render(<PosinowaYukleniyor />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";

    expect((d.match(/Z/g) ?? []).length).toBe(2);
    expect((d.match(/M /g) ?? []).length).toBe(2);
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
});

describe("PosinowaYukleniyor — kutu", () => {
  it("viewBox logonun kutusundan GENİŞ; çizginin dış yarısı kırpılmaz", () => {
    // Çizgi hattın üzerinde ortalanıyor. Pay olmasa 0 ve 511'e değen
    // kenarlarda hattın yarısı kesilirdi.
    const { container } = render(<PosinowaYukleniyor />);
    const [x, y, g, h] = svgAl(container).getAttribute("viewBox")!.split(" ").map(Number);
    const kalinlik = Number(container.querySelector("g")?.getAttribute("stroke-width"));

    expect(x).toBeLessThanOrEqual(-kalinlik / 2);
    expect(y).toBeLessThanOrEqual(-kalinlik / 2);
    expect(g + x).toBeGreaterThanOrEqual(511 + kalinlik / 2);
    expect(h + y).toBeGreaterThanOrEqual(482 + kalinlik / 2);
  });

  it("en-boy oranı korunur", () => {
    const { container } = render(<PosinowaYukleniyor boyut={100} />);
    const svg = svgAl(container);
    const [, , g, h] = svg.getAttribute("viewBox")!.split(" ").map(Number);

    expect(svg.getAttribute("width")).toBe("100");
    expect(svg.getAttribute("height")).toBe(String(Math.round((100 * h) / g)));
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
    const svg = svgAl(container);

    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
