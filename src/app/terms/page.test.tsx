// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import TermsPage from "./page";
import PrivacyPage from "../privacy/page";

describe("Yasal sayfalar (#171)", () => {
  it("Kullanım Koşulları başlığı ve gizliliğe çapraz bağlantı render edilir", () => {
    render(<TermsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Kullanım Koşulları" }),
    ).toBeInTheDocument();
    // Kayıt ekranındaki 404 linkinin hedefi artık gerçek içerik gösteriyor
    expect(screen.getByRole("link", { name: /Gizlilik Politikası/ })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("Gizlilik Politikası başlığı ve koşullara çapraz bağlantı render edilir", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Gizlilik Politikası" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Kullanım Koşulları/ })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("her iki sayfa da kayıt sayfasına dönüş bağlantısı sunar", () => {
    const { unmount } = render(<TermsPage />);
    expect(screen.getByRole("link", { name: /Kayıt sayfasına dön/ })).toHaveAttribute(
      "href",
      "/signup",
    );
    unmount();

    render(<PrivacyPage />);
    expect(screen.getByRole("link", { name: /Kayıt sayfasına dön/ })).toHaveAttribute(
      "href",
      "/signup",
    );
  });
});
