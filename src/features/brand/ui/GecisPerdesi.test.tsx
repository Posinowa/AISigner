// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { GecisPerdesi } from "./GecisPerdesi";

/**
 * #285 — geçiş perdesi sözleşmesi.
 *
 * Perdenin işi ekranı BOŞALTMAK. Yarı saydam olduğunda çizim, altındaki
 * sayfanın üstünde yüzüyormuş gibi duruyor ve "geçiş" hissi kayboluyor.
 */

describe("GecisPerdesi", () => {
  it("arkadaki sayfayı TAMAMEN kapatır", () => {
    render(<GecisPerdesi />);
    const perde = screen.getByRole("status");
    const sinif = perde.className;

    expect(sinif).toContain("fixed");
    expect(sinif).toContain("inset-0");
    expect(sinif).toContain("bg-white");
    // Saydamlık eki (bg-white/95) veya bulanıklık = arkası görünür.
    expect(sinif).not.toMatch(/bg-white\//);
    expect(sinif).not.toContain("backdrop-blur");
  });

  it("logo perdenin beyazına karşı SİYAH çizilir", () => {
    render(<GecisPerdesi />);
    expect(screen.getByRole("status").querySelector("svg")?.getAttribute("class")).toContain(
      "text-black",
    );
  });

  it("ne beklendiği yazıyla da söylenir", () => {
    render(<GecisPerdesi mesaj="Mentör başvurusu açılıyor..." />);
    expect(screen.getByText("Mentör başvurusu açılıyor...")).toBeInTheDocument();
  });

  it("gösterge ekran okuyucuya İKİ KEZ duyurulmaz", () => {
    // Perdenin kendisi role=status; içindeki logo dekoratif olmalı.
    render(<GecisPerdesi />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      screen.getByRole("status").querySelector("svg")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
  it("perde <body>e basılır — transformlu bir atanın içine DEĞİL", () => {
    // Asıl kusur buydu: açılış sayfasındaki CTAların atası transform taşıyor.
    // Transformlu ata, position:fixed için kapsayıcı blok oluşturuyor; perde
    // tüm ekran yerine yalnızca o kutuyu kaplıyordu.
    const { container } = render(<GecisPerdesi />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.getByRole("status").parentElement).toBe(document.body);
  });
});
