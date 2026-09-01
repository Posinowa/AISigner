// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * #261 — yeniden gönderme eylemi.
 *
 * En kritik davranış: doğrulanmış hesapta bu düğme HİÇ görünmemeli; aksi
 * halde gereksiz e-posta tetiklenir ve kullanıcı kafası karışır.
 */

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { DogrulamaYenidenGonder } from "./DogrulamaYenidenGonder";

const dugme = () => screen.getByRole("button", { name: /yeniden gönder/i });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Doğrulama bağlantısı e-posta adresinize gönderildi." }),
    }),
  );
});

describe("doğrulanmış hesap", () => {
  it("hiçbir şey render EDİLMEZ", () => {
    const { container } = render(
      <DogrulamaYenidenGonder emailVerified="2026-08-21T10:00:00.000Z" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Date nesnesiyle de gizlenir", () => {
    const { container } = render(<DogrulamaYenidenGonder emailVerified={new Date()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("doğrulanmamış hesap", () => {
  it.each([null, undefined, ""])("(%s) düğme gösterilir", (deger) => {
    render(<DogrulamaYenidenGonder emailVerified={deger} />);
    expect(dugme()).toBeInTheDocument();
  });

  it("tıklanınca istek atılır", async () => {
    render(<DogrulamaYenidenGonder emailVerified={null} />);
    fireEvent.click(dugme());

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/resend-verification",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("başarı mesajı gösterilir", async () => {
    render(<DogrulamaYenidenGonder emailVerified={null} />);
    fireEvent.click(dugme());

    expect(await screen.findByText(/gönderildi/i)).toBeInTheDocument();
  });

  it("oran sınırı mesajı kullanıcıya gösterilir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Çok fazla doğrulama e-postası istediniz." }),
      }),
    );

    render(<DogrulamaYenidenGonder emailVerified={null} />);
    fireEvent.click(dugme());

    expect(await screen.findByText(/çok fazla/i)).toBeInTheDocument();
  });

  it("hata sonrası başarı mesajı GÖSTERİLMEZ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "hata" }) }),
    );

    render(<DogrulamaYenidenGonder emailVerified={null} />);
    fireEvent.click(dugme());

    await screen.findByText("hata");
    expect(screen.queryByText(/gönderildi/i)).toBeNull();
  });

  it("ağ hatası çökmeye yol açmaz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<DogrulamaYenidenGonder emailVerified={null} />);
    fireEvent.click(dugme());

    expect(await screen.findByText(/bağlantı hatası/i)).toBeInTheDocument();
  });

  it("hesap bu arada doğrulanmışsa ekran tazelenir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ alreadyVerified: true, message: "Hesabınız zaten doğrulanmış." }),
      }),
    );

    render(<DogrulamaYenidenGonder emailVerified={null} />);
    fireEvent.click(dugme());

    await screen.findByText(/zaten doğrulanmış/i);
    expect(refreshMock).toHaveBeenCalled();
  });
});
