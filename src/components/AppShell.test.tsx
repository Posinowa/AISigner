// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/student-dashboard" }));
vi.mock("@/components/LogoutButton", () => ({ default: () => null }));
vi.mock("@/features/messaging/ui/UnreadBadge", () => ({ UnreadBadge: () => null }));
vi.mock("@/features/workspace-requests/ui/BekleyenTalepRozeti", () => ({
  BekleyenTalepRozeti: () => null,
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
  it("aktif stajyer iki bağlantıyı da görür", () => {
    render(<AppShell role="STUDENT" />);
    expect(screen.getByRole("link", { name: "Projemi Öner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mentör Görüşmesi" })).toBeInTheDocument();
  });

  it("⚠️ MEZUN stajyerde 'Projemi Öner' GİZLİ (#208)", () => {
    render(<AppShell role="STUDENT" mezun />);
    expect(screen.queryByRole("link", { name: "Projemi Öner" })).not.toBeInTheDocument();
  });

  it("⚠️ MEZUN stajyerde 'Mentör Görüşmesi' AÇIK kalır (#398)", () => {
    render(<AppShell role="STUDENT" mezun />);
    expect(screen.getByRole("link", { name: "Mentör Görüşmesi" })).toBeInTheDocument();
  });

  it("mevcut bağlantılar korunuyor", () => {
    render(<AppShell role="STUDENT" mezun />);
    for (const ad of ["Panel", "Mesajlar", "AI Analizim", "Öneri & İstek"]) {
      expect(screen.getByRole("link", { name: ad })).toBeInTheDocument();
    }
  });

  it("mezun bayrağı diğer rolleri etkilemez", () => {
    render(<AppShell role="MENTOR" mezun />);
    expect(screen.getByRole("link", { name: "Analitik" })).toBeInTheDocument();
  });
});
