// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { RevizyonIste } from "./RevizyonIste";

/**
 * #379 — revizyon formu.
 *
 * ⚠️ CANLI TESTTE BULUNDU: kısa gerekçede buton pasif kalıyor ama nedeni
 * hiçbir yerde yazmıyordu. Sınır şemayla aynı sabitten okunuyor
 * (`REVIZYON_GEREKCE_EN_AZ`); test sayıyı değil davranışı kilitliyor.
 */
function formuAc() {
  render(<RevizyonIste stepId="s1" stepStatus="COMPLETED" />);
  fireEvent.click(screen.getByRole("button", { name: /revizyon iste/i }));
  return screen.getByRole("textbox");
}

describe("RevizyonIste — gerekçe alt sınırı", () => {
  it("kısa gerekçede butonu pasif tutar ve NEDENİNİ söyler", () => {
    const alan = formuAc();
    fireEvent.change(alan, { target: { value: "kısa" } });

    expect(screen.getByRole("button", { name: /revizyon iste/i })).toBeDisabled();
    expect(screen.getByText(/En az \d+ karakter yazın \(4\/\d+\)/)).toBeInTheDocument();
  });

  it("boşlukları saymaz", () => {
    const alan = formuAc();
    fireEvent.change(alan, { target: { value: "            " } });

    expect(screen.getByRole("button", { name: /revizyon iste/i })).toBeDisabled();
    expect(screen.getByText(/\(0\/\d+\)/)).toBeInTheDocument();
  });

  it("yeterli gerekçede butonu açar ve ipucunu kaldırır", () => {
    const alan = formuAc();
    fireEvent.change(alan, { target: { value: "Testler yazılmamış, tamamlayıp gönder." } });

    expect(screen.getByRole("button", { name: /revizyon iste/i })).toBeEnabled();
    expect(screen.queryByText(/karakter yazın/)).toBeNull();
  });

  it("ipucu alana bağlı (ekran okuyucu)", () => {
    const alan = formuAc();

    expect(alan).toHaveAttribute("aria-describedby", "rev-s1-sinir");
  });
});
