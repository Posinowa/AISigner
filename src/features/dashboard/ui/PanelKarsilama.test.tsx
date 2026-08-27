// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { PanelKarsilama } from "./PanelKarsilama";
import { DogrulanmisRozet } from "@/features/auth/ui/DogrulanmisRozet";

/**
 * #290 — karşılamanın sözleşmesi.
 *
 * Karşılama üç soruya cevap vermeli: kimsin, nerede duruyorsun, sırada ne var.
 * Ve bir şeye cevap VERMEMELİ: idari uyarılar. Önceden "Doğrulanmamış" ibaresi
 * kullanıcının adının hemen yanında duruyordu ve karşılamayı ele geçiriyordu.
 */

const ortak = {
  ad: "Ayşe",
  basHarfler: "AY",
  userId: "k1",
  fotografVar: false,
  durum: "Çalışma masan hazır.",
};

describe("PanelKarsilama — karşılama", () => {
  it("isimle karşılar ve nerede durduğunu söyler", () => {
    render(<PanelKarsilama {...ortak} siradaki={null} />);

    expect(screen.getByRole("heading", { name: "Hoş geldin, Ayşe" })).toBeInTheDocument();
    expect(screen.getByText("Çalışma masan hazır.")).toBeInTheDocument();
  });

  it("fotoğraf yoksa baş harflere düşer — kırık görsel göstermez", () => {
    const { container } = render(<PanelKarsilama {...ortak} siradaki={null} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AY")).toBeInTheDocument();
  });
});

describe("PanelKarsilama — sıradaki eylem", () => {
  it("eylem varsa hedefiyle birlikte gösterilir", () => {
    render(
      <PanelKarsilama
        {...ortak}
        siradaki={{ etiket: "Testleri yaz", aciklama: "Blog API · sıradaki adım", href: "#projeler" }}
      />,
    );

    const bag = screen.getByText("Testleri yaz").closest("a");
    expect(bag).toHaveAttribute("href", "#projeler");
    expect(screen.getByText("Sırada")).toBeInTheDocument();
  });

  it("eylem YOKKEN boş bir kutu bırakılmaz", () => {
    const { container } = render(<PanelKarsilama {...ortak} siradaki={null} />);

    expect(screen.queryByText("Sırada")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});

describe("PanelKarsilama — idari uyarılar", () => {
  it("doğrulanmamış hesabın UYARISI karşılamaya girmez", () => {
    // Asıl kusur buydu: uyarı ismin yanında duruyordu. Rozet yalnızca
    // olumlu ibareyi göstermek üzere geçiliyor; uyarı profil şeridinde.
    render(
      <PanelKarsilama
        {...ortak}
        siradaki={null}
        rozet={<DogrulanmisRozet emailVerified={null} dogrulanmamisiGoster={false} />}
      />,
    );

    expect(screen.queryByText("Doğrulanmamış")).toBeNull();
  });

  it("doğrulanmış hesabın rozeti gösterilir", () => {
    render(
      <PanelKarsilama
        {...ortak}
        siradaki={null}
        rozet={
          <DogrulanmisRozet
            emailVerified={new Date().toISOString()}
            dogrulanmamisiGoster={false}
          />
        }
      />,
    );

    expect(screen.getByText("Doğrulanmış hesap")).toBeInTheDocument();
  });
});
