// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { DogrulanmisRozet, dogrulandiMi } from "./DogrulanmisRozet";

/**
 * #259 — doğrulama ibaresi.
 *
 * En kritik davranış: doğrulanmamış bir hesap ASLA doğrulanmış görünmemeli.
 * Alan sunucudan JSON ile gelince tarih string'e döndüğü için her iki biçim
 * de doğru yorumlanmalı.
 */

describe("dogrulandiMi", () => {
  it("Date nesnesi doğrulanmış sayılır", () => {
    expect(dogrulandiMi(new Date())).toBe(true);
  });

  it("ISO string doğrulanmış sayılır", () => {
    // JSON üzerinden gelen biçim.
    expect(dogrulandiMi("2026-08-21T18:19:12.837Z")).toBe(true);
  });

  it.each([null, undefined, ""])("%s doğrulanmamış sayılır", (deger) => {
    expect(dogrulandiMi(deger)).toBe(false);
  });

  it("bozuk tarih string'i doğrulanmış SAYILMAZ", () => {
    // Aksi halde çöp veri hesabı doğrulanmış gösterirdi.
    expect(dogrulandiMi("bu-tarih-degil")).toBe(false);
  });
});

describe("DogrulanmisRozet — doğrulanmış", () => {
  it("olumlu ibare gösterilir", () => {
    render(<DogrulanmisRozet emailVerified={new Date()} />);
    expect(screen.getByText("Doğrulanmış hesap")).toBeInTheDocument();
    expect(screen.queryByText("Doğrulanmamış")).toBeNull();
  });
});

describe("DogrulanmisRozet — doğrulanmamış", () => {
  it("uyarı ibaresi gösterilir", () => {
    render(<DogrulanmisRozet emailVerified={null} />);
    expect(screen.getByText("Doğrulanmamış")).toBeInTheDocument();
    expect(screen.queryByText("Doğrulanmış hesap")).toBeNull();
  });

  it("dogrulanmamisiGoster kapalıyken hiçbir şey render edilmez", () => {
    const { container } = render(
      <DogrulanmisRozet emailVerified={null} dogrulanmamisiGoster={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("doğrulanmışsa dogrulanmamisiGoster kapalı olsa da ibare çıkar", () => {
    render(
      <DogrulanmisRozet emailVerified={new Date()} dogrulanmamisiGoster={false} />,
    );
    expect(screen.getByText("Doğrulanmış hesap")).toBeInTheDocument();
  });
});

describe("DogrulanmisRozet — erişilebilirlik", () => {
  it("durum yalnızca renkle değil METİNLE de anlatılır", () => {
    // Renk körü kullanıcı için ikon/renk tek başına yeterli değil.
    const { container } = render(<DogrulanmisRozet emailVerified={null} />);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("ikon ekran okuyucudan gizlenir", () => {
    const { container } = render(<DogrulanmisRozet emailVerified={new Date()} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
