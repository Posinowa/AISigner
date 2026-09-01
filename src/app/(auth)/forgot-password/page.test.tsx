// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * #262 — sıfırlama talebi ekranı.
 *
 * Akış artık tek adım. En kritik davranış: başarı ekranı hesabın var olup
 * olmadığını ELE VERMEMELİ.
 */

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import ForgotPasswordPage from "./page";

function doldurVeGonder(email = "kisi@ornek.com") {
  fireEvent.change(screen.getByLabelText(/e-posta/i), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /gönder/i }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Bu e-posta adresi kayıtlıysa..." }),
    }),
  );
});

describe("forgot-password — talep", () => {
  it("e-posta alanı ve gönder butonu vardır", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText(/e-posta/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gönder/i })).toBeInTheDocument();
  });

  it("güvenlik sorusu SORULMAZ", () => {
    // Eski akış üç adımlı bir sihirbazdı; artık sorular sıfırlama yolunda değil.
    render(<ForgotPasswordPage />);

    expect(screen.queryByText(/güvenlik soru/i)).toBeNull();
  });

  it("yeni uca istek atılır", async () => {
    render(<ForgotPasswordPage />);
    doldurVeGonder();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/reset-password",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("gönderim sonrası hesap varlığını ele vermeyen mesaj gösterilir", async () => {
    render(<ForgotPasswordPage />);
    doldurVeGonder();

    expect(await screen.findByText(/kayıtlıysa/i)).toBeInTheDocument();
  });

  it("bağlantının tek kullanımlık olduğu belirtilir", async () => {
    render(<ForgotPasswordPage />);
    doldurVeGonder();

    expect(await screen.findByText(/bir kez kullanılabilir/i)).toBeInTheDocument();
  });
});

describe("forgot-password — hata", () => {
  it("sunucu hatası kullanıcıya gösterilir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Çok fazla deneme yaptınız." }),
      }),
    );

    render(<ForgotPasswordPage />);
    doldurVeGonder();

    expect(await screen.findByText(/çok fazla deneme/i)).toBeInTheDocument();
  });

  it("ağ hatası çökmeye yol açmaz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<ForgotPasswordPage />);
    doldurVeGonder();

    expect(await screen.findByText(/bağlantı hatası/i)).toBeInTheDocument();
  });

  it("hata sonrası başarı ekranına GEÇİLMEZ", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<ForgotPasswordPage />);
    doldurVeGonder();

    await screen.findByText(/bağlantı hatası/i);
    expect(screen.queryByText(/kayıtlıysa/i)).toBeNull();
  });
});
