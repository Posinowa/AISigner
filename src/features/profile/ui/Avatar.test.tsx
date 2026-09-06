// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

/**
 * #265 — fotoğraf yoksa eski davranış (baş harfler) korunmalı; fotoğraf varsa
 * gereksiz istek atılmadan doğru uca gidilmeli.
 */

describe("Avatar — fotoğraf yok", () => {
  it("baş harfler gösterilir", () => {
    render(<Avatar userId="k1" basHarfler="AY" fotografVar={false} />);
    expect(screen.getByText("AY")).toBeInTheDocument();
  });

  it("resim isteği ATILMAZ", () => {
    // Fotoğrafı olmayan her kullanıcı için 404 isteği atmanın anlamı yok.
    const { container } = render(
      <Avatar userId="k1" basHarfler="AY" fotografVar={false} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("rol rengi fallback'te korunur", () => {
    const { container } = render(
      <Avatar
        userId="k1"
        basHarfler="AY"
        fotografVar={false}
        arkaPlanSinifi="bg-test-rengi"
      />,
    );
    expect(container.querySelector(".bg-test-rengi")).not.toBeNull();
  });
});

describe("Avatar — fotoğraf var", () => {
  it("doğru uca gidilir", () => {
    const { container } = render(
      <Avatar userId="k42" basHarfler="AY" fotografVar />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/users/k42/avatar",
    );
  });

  it("baş harfler artık gösterilmez", () => {
    render(<Avatar userId="k1" basHarfler="AY" fotografVar />);
    expect(screen.queryByText("AY")).toBeNull();
  });

  it("anlamlı alt metni vardır", () => {
    render(<Avatar userId="k1" basHarfler="AY" fotografVar ad="Ayse Yilmaz" />);
    expect(screen.getByAltText(/Ayse Yilmaz/)).toBeInTheDocument();
  });

  it("ad verilmezse de alt metni boş kalmaz", () => {
    render(<Avatar userId="k1" basHarfler="AY" fotografVar />);
    expect(screen.getByAltText("Profil fotoğrafı")).toBeInTheDocument();
  });
});
