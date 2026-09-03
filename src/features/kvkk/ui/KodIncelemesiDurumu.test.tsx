// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { KodIncelemesiDurumuRozeti } from "./KodIncelemesiDurumu";

/**
 * #394 — Engellemenin SEBEBİ mentöre söyleniyor.
 */
const durum = (over = {}) => ({
  acikMi: false,
  rizasiEksikler: [{ userId: "u1", ad: "Ayşe Yılmaz" }],
  sahipYok: false,
  ...over,
});

describe("KodIncelemesiDurumuRozeti", () => {
  it("rıza eksikse SEBEBİ ve nasıl açılacağı yazılı", () => {
    render(<KodIncelemesiDurumuRozeti durum={durum()} githubStatus="READY" />);
    expect(screen.getByText(/AI kod incelemesi kapalı/)).toBeInTheDocument();
    expect(screen.getByText(/Ayşe Yılmaz/)).toBeInTheDocument();
    expect(screen.getByText(/kendiliğinden açılır/)).toBeInTheDocument();
  });

  it("kural da açıklanıyor — mentör 'neden herkes?' sorusunu sormasın", () => {
    render(<KodIncelemesiDurumuRozeti durum={durum()} githubStatus="READY" />);
    expect(screen.getByText(/hangi satırı kimin yazdığı bilinmediği/)).toBeInTheDocument();
  });

  it("rıza tamsa nötr bir 'açık' ifadesi", () => {
    render(
      <KodIncelemesiDurumuRozeti
        durum={durum({ acikMi: true, rizasiEksikler: [] })}
        githubStatus="READY"
      />,
    );
    expect(screen.getByText(/AI kod incelemesi açık/)).toBeInTheDocument();
    expect(screen.queryByText(/kapalı/)).not.toBeInTheDocument();
  });

  /*
   * ⚠️ BAGLA/LINKED depolarda kod incelemesi ZATEN çalışmıyor (#366): depo
   * stajyerin hesabında, webhook gelmiyor. Orada rıza durumunu göstermek
   * YANLIŞ SEBEBİ işaret ederdi.
   */
  it("⚠️ LINKED depoda rıza değil DEPO sebebi gösterilir (#366)", () => {
    render(<KodIncelemesiDurumuRozeti durum={durum()} githubStatus="LINKED" />);
    expect(screen.getByText(/stajyerin hesabında/)).toBeInTheDocument();
    expect(screen.queryByText(/Ayşe Yılmaz/)).not.toBeInTheDocument();
  });

  it("sahibi bulunamayan atamada isim listelenmez", () => {
    render(
      <KodIncelemesiDurumuRozeti
        durum={durum({ sahipYok: true, rizasiEksikler: [] })}
        githubStatus="READY"
      />,
    );
    expect(screen.getByText(/sahibi bulunamadı/)).toBeInTheDocument();
  });

  it("birden çok eksik üyede çoğul dil kullanılır", () => {
    render(
      <KodIncelemesiDurumuRozeti
        durum={durum({
          rizasiEksikler: [
            { userId: "u1", ad: "Ayşe" },
            { userId: "u2", ad: "Mehmet" },
          ],
        })}
        githubStatus="READY"
      />,
    );
    expect(screen.getByText(/üyeler var/)).toBeInTheDocument();
    expect(screen.getByText(/Ayşe, Mehmet/)).toBeInTheDocument();
  });
});
