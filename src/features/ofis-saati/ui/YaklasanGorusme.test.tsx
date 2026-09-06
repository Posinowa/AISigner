// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { YaklasanGorusme } from "./YaklasanGorusme";

/**
 * #420: Takvim kendi sayfasına taşındı ama REZERVASYON panoda kalır.
 *
 * #398: "Rezerve edilmiş bir görüşme zamana bağlı bilgidir; bir tıkın
 * arkasına saklanırsa kaçırılır."
 */
const slot = (over = {}) => ({
  id: "s1",
  baslangic: new Date("2026-09-10T11:00:00.000Z"),
  bitis: new Date("2026-09-10T11:20:00.000Z"),
  mentorAdi: "Mentor User",
  gorusmeLinki: null as string | null,
  ...over,
});

describe("YaklasanGorusme", () => {
  it("rezervasyon yoksa HİÇ basılmaz — boş kart yer kaplamaktan başka bir şey yapmaz", () => {
    const { container } = render(<YaklasanGorusme slot={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("rezervasyon varsa mentör adı ve saat gösterilir", () => {
    render(<YaklasanGorusme slot={slot()} />);
    expect(screen.getByText(/Mentor User/)).toBeInTheDocument();
    expect(screen.getByText("Yaklaşan mentör görüşmen")).toBeInTheDocument();
  });

  /**
   * #460 — SAATİN DOĞRU OLDUĞU da doğrulanmalı.
   *
   * ⚠️ BU TEST OLMADIĞI İÇİN HATA HAYATTA KALDI. Üstteki test saatin
   * GÖSTERİLDİĞİNİ ölçüyordu, DOĞRU olduğunu değil — #455'te KVKK metninde
   * yaşanan aynı boşluk.
   *
   * Bu bileşen bir Server Component içinde render ediliyor ve üretimde
   * konteyner UTC: saat dilimi verilmediğinde TR saatiyle 14:00'lik görüşme
   * panoda 11:00 görünüyordu. Süreç dilimi bilerek UTC'ye çekiliyor; aksi
   * halde geliştirme makinesi zaten UTC+3 olduğu için hatalı bir uygulama
   * bu testten GEÇERDİ (#398'de aynı önlem alınmıştı).
   */
  it("⚠️ saat TR dilimindedir — UTC sunucuda da 14:00 basar", () => {
    const asil = process.env.TZ;
    process.env.TZ = "UTC";
    try {
      // 11:00Z = TR saatiyle 14:00
      render(<YaklasanGorusme slot={slot()} />);
      expect(screen.getByText(/14:00/)).toBeInTheDocument();
      expect(screen.queryByText(/11:00/)).not.toBeInTheDocument();
    } finally {
      process.env.TZ = asil;
    }
  });

  it("bağlantı yoksa 'Katıl' düğmesi çıkmaz", () => {
    render(<YaklasanGorusme slot={slot()} />);
    // ⚠️ METNE bakılıyor, role değil: `href`siz bir <a> "link" rolünü
    // ALMIYOR, dolayısıyla rol sorgusu bağlantısız basilan bir düğmeyi
    // göremiyordu. Mutasyon testinde bulundu: koşulu kaldıran sürüm hayatta
    // kalıyordu.
    expect(screen.queryByText("Katıl")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Takvim" })).toBeInTheDocument();
  });

  it("bağlantı varsa 'Katıl' yeni sekmede ve rel korumalı açılır", () => {
    render(<YaklasanGorusme slot={slot({ gorusmeLinki: "https://meet.google.com/abc" })} />);
    const a = screen.getByRole("link", { name: /Katıl/ });
    expect(a).toHaveAttribute("href", "https://meet.google.com/abc");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("takvim bağlantısı yeni sayfaya gider", () => {
    render(<YaklasanGorusme slot={slot()} />);
    expect(screen.getByRole("link", { name: "Takvim" })).toHaveAttribute(
      "href",
      "/student-dashboard/ofis-saati",
    );
  });
});
