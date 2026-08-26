// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * #262 — yeni şifre belirleme ekranı.
 *
 * Token URL'den geliyor; doğrulama sunucuda. Bu testler tokenın taşındığını
 * ve token yokken boş istek atılmadığını kilitliyor.
 */

const { paramsMock } = vi.hoisted(() => ({ paramsMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => paramsMock(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import ResetPasswordPage from "./page";

function tokenIle(token: string | null) {
  paramsMock.mockReturnValue({ get: () => token });
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  tokenIle("gecerli-token");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: "ok" }) }),
  );
});

describe("reset-password — token yok", () => {
  it("form gösterilmez, uyarı çıkar", () => {
    tokenIle(null);
    render(<ResetPasswordPage />);

    expect(screen.getByText(/bağlantı okunamadı/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/yeni şifre/i)).toBeNull();
  });

  it("yeni bağlantı isteme yolu sunulur", () => {
    tokenIle(null);
    render(<ResetPasswordPage />);

    expect(screen.getByText(/yeni bir sıfırlama bağlantısı/i)).toBeInTheDocument();
  });

  it("token yokken sunucuya istek ATILMAZ", () => {
    tokenIle(null);
    render(<ResetPasswordPage />);

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("reset-password — token var", () => {
  it("şifre alanı gösterilir", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText(/yeni şifre/i)).toBeInTheDocument();
  });

  it("token istekle birlikte gönderilir", async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/yeni şifre/i), {
      target: { value: "YeniSifre1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /güncelle/i }));

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const govde = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    expect(govde.token).toBe("gecerli-token");
    expect(govde.password).toBe("YeniSifre1!");
  });

  it("başarıda bağlantının artık geçersiz olduğu söylenir", async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText(/yeni şifre/i), {
      target: { value: "YeniSifre1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /güncelle/i }));

    expect(await screen.findByText(/artık geçersiz/i)).toBeInTheDocument();
  });

  it("sunucu hatası kullanıcıya gösterilir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Bağlantının süresi doldu." }),
      }),
    );

    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText(/yeni şifre/i), {
      target: { value: "YeniSifre1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /güncelle/i }));

    expect(await screen.findByText(/süresi doldu/i)).toBeInTheDocument();
  });

  it("hata sonrası başarı ekranına geçilmez", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "x" }) }),
    );

    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText(/yeni şifre/i), {
      target: { value: "YeniSifre1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /güncelle/i }));

    await screen.findByText("x");
    expect(screen.queryByText(/artık geçersiz/i)).toBeNull();
  });
});
