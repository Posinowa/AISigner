// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/student-dashboard" }));
vi.mock("@/components/LogoutButton", () => ({ default: () => null }));
vi.mock("@/features/messaging/ui/UnreadBadge", () => ({
  UnreadBadge: () => <span data-testid="okunmamis-rozeti" />,
}));
vi.mock("@/features/workspace-requests/ui/BekleyenTalepRozeti", () => ({
  BekleyenTalepRozeti: () => <span data-testid="talep-rozeti" />,
}));
vi.mock("@/features/bildirim/ui/BildirimZili", () => ({ BildirimZili: () => null }));

import { AppShell } from "./AppShell";

/**
 * #420: "Projemi Öner" ve "Mentör Görüşmesi" üst menüye taşındı.
 *
 * ⚠️ İkisi MEZUNDA FARKLI davranıyor ve bu bilinçli:
 *  - Öneri #208'de kapalı (sistem durumunu değiştiren uç).
 *  - Görüşme #398'de AÇIK (insan iletişimi kanalı, mesajlaşmanın eşi).
 * Erişemeyeceği bir sayfaya bağlantı göstermek yanıltıcı olurdu.
 */
describe("AppShell — öğrenci menüsü (#420)", () => {
  it("aktif stajyer üç bağlantıyı da görür", () => {
    render(<AppShell role="STUDENT" />);
    expect(screen.getByRole("link", { name: "Projemi Öner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mentör Görüşmesi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ayarlar" })).toBeInTheDocument();
  });

  it("⚠️ MEZUN stajyerde 'Projemi Öner' GİZLİ (#208)", () => {
    render(<AppShell role="STUDENT" mezun />);
    expect(screen.queryByRole("link", { name: "Projemi Öner" })).not.toBeInTheDocument();
  });

  it("⚠️ MEZUN stajyerde 'Mentör Görüşmesi' ve 'Ayarlar' AÇIK kalır (#398, #538)", () => {
    render(<AppShell role="STUDENT" mezun />);
    expect(screen.getByRole("link", { name: "Mentör Görüşmesi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ayarlar" })).toBeInTheDocument();
  });

  it("mevcut bağlantılar korunuyor", () => {
    render(<AppShell role="STUDENT" mezun />);
    for (const ad of ["Panel", "Mesajlar", "AI Analizim", "Öneri & İstek", "Ayarlar"]) {
      expect(screen.getByRole("link", { name: ad })).toBeInTheDocument();
    }
  });

  it("mezun bayrağı diğer rolleri etkilemez", () => {
    render(<AppShell role="MENTOR" mezun />);
    expect(screen.getByRole("link", { name: "Analitik" })).toBeInTheDocument();
  });
});

/**
 * #409 — Admin üst menüsü dar ekranlarda kayıyordu.
 *
 * Ölçüm: menü TAŞMIYOR (kapsayıcıda `overflow-x-auto`), yani düzen
 * bozulmuyor — sorun keşfedilebilirlik. 1280'de menü 821px, 1024'te 149px'i
 * görünmez haldeydi.
 */
describe("AppShell — admin menüsü (#409)", () => {
  it("etiketler kısa — uzun başlıklar kaldırıldı", () => {
    render(<AppShell role="ADMIN" />);
    expect(screen.getByRole("link", { name: "Talepler" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Öneriler" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Çalışma Alanı Talepleri" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Proje Önerileri" })).not.toBeInTheDocument();
  });

  it("⚠️ HİÇBİR ÖĞE GİZLENMEDİ — sekiz bağlantının hepsi duruyor", () => {
    render(<AppShell role="ADMIN" />);
    for (const ad of [
      "Panel",
      "Projeler",
      "Talepler",
      "Öneriler",
      "Analitik",
      "Takımlar",
      "Mesajlar",
      "İstekler",
    ]) {
      expect(screen.getByRole("link", { name: new RegExp(ad) })).toBeInTheDocument();
    }
  });

  /*
   * ⚠️ AÇILIR MENÜ YAPILMADI. `UnreadBadge` ve `BekleyenTalepRozeti`
   * bağlantıların İÇİNDE; açılır menüye taşınan bir öğenin rozeti görünmez
   * olurdu ve kaybedilen şey bir özellik değil BİLDİRİM olurdu — #349'un
   * rozeti tam da darboğazı görünür kılmak için konmuştu.
   */
  it("⚠️ rozetler bağlantıların İÇİNDE kalıyor", () => {
    render(<AppShell role="ADMIN" />);

    const talep = screen.getByRole("link", { name: /Talepler/ });
    expect(talep.querySelector("[data-testid='talep-rozeti']")).toBeInTheDocument();

    const mesaj = screen.getByRole("link", { name: /Mesajlar/ });
    expect(mesaj.querySelector("[data-testid='okunmamis-rozeti']")).toBeInTheDocument();
  });

  /*
   * ⚠️ "İstekler" (#147: stajyer→admin öneri/istek) ile "Öneriler" (#366:
   * stajyerin kendi PROJE önerisi) FARKLI şeyler; kısa adlar birbirine
   * karışmamalı.
   */
  it("⚠️ 'İstekler' ve 'Öneriler' AYRI hedeflere gidiyor", () => {
    render(<AppShell role="ADMIN" />);
    expect(screen.getByRole("link", { name: "İstekler" })).toHaveAttribute(
      "href",
      "/admin-dashboard/suggestions",
    );
    expect(screen.getByRole("link", { name: "Öneriler" })).toHaveAttribute(
      "href",
      "/admin-dashboard/proposals",
    );
  });
});
