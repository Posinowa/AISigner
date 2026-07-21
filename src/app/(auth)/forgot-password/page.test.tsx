// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "./page";

/** fetch yanıtı taklidi. */
function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const questions = [
  { questionId: 0, question: "İlk evcil hayvanınızın adı neydi?" },
  { questionId: 1, question: "İlk okulunuzun adı neydi?" },
];

/** 1. adımı geçip soru ekranına ulaş. */
async function reachQuestions() {
  fetchMock.mockResolvedValueOnce(jsonResponse({ step: "questions", questions }));

  fireEvent.change(screen.getByLabelText("E-posta Adresi"), {
    target: { value: "user@test.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Devam Et" }));

  await screen.findByText("Güvenlik Soruları");
}

/** 2. adımı geçip yeni şifre ekranına ulaş. */
async function reachNewPassword() {
  await reachQuestions();

  fetchMock.mockResolvedValueOnce(
    jsonResponse({ step: "verified", resetToken: "t".repeat(64) }),
  );

  questions.forEach((q, i) => {
    fireEvent.change(screen.getByLabelText(`${i + 1}. ${q.question}`), {
      target: { value: "cevap" },
    });
  });
  fireEvent.click(screen.getByRole("button", { name: "Cevapları Doğrula" }));

  await screen.findByText("Yeni Şifre Belirle");
}

describe("Şifre sıfırlama akışı (#156)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    render(<ForgotPasswordPage />);
  });

  it("e-posta gönderilince sorular ekranına geçilir", async () => {
    await reachQuestions();

    expect(screen.getByLabelText(/İlk evcil hayvanınızın adı/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/forgot-password/verify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("e-posta küçük harfe çevrilerek gönderilir", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ step: "questions", questions }));

    fireEvent.change(screen.getByLabelText("E-posta Adresi"), {
      target: { value: "  USER@Test.COM  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Devam Et" }));

    await screen.findByText("Güvenlik Soruları");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.email).toBe("user@test.com");
  });

  it("adım değişince odak başlığa taşınır", async () => {
    await reachQuestions();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    });
  });

  it("ilk açılışta odak çalınmaz", () => {
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveFocus();
  });

  it("adım göstergesi ekran okuyucuya hangi adımda olunduğunu söyler", async () => {
    expect(screen.getByText("3 adımdan 1. adımdasınız.")).toBeInTheDocument();

    await reachQuestions();
    expect(screen.getByText("3 adımdan 2. adımdasınız.")).toBeInTheDocument();
  });

  it("sunucu hatası role='alert' ile duyurulur", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Çok fazla deneme yaptınız." }, false),
    );

    fireEvent.change(screen.getByLabelText("E-posta Adresi"), {
      target: { value: "user@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Devam Et" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Çok fazla deneme yaptınız.");
  });

  it("ağ hatası kullanıcıya bildirilir", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));

    fireEvent.change(screen.getByLabelText("E-posta Adresi"), {
      target: { value: "user@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Devam Et" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı hatası");
  });

  it("'Geri dön' e-posta adımına döndürür", async () => {
    await reachQuestions();

    fireEvent.click(screen.getByRole("button", { name: /Geri dön/ }));

    expect(await screen.findByText("Şifremi Unuttum")).toBeInTheDocument();
  });

  it("cevaplar doğrulanınca yeni şifre adımına geçilir", async () => {
    await reachNewPassword();

    expect(screen.getByLabelText("Yeni Şifre")).toBeInTheDocument();
    expect(screen.getByLabelText("Şifreyi Tekrar Gir")).toBeInTheDocument();
  });

  it("şifreler eşleşmezse uyarı alan hatası olarak bağlanır", async () => {
    await reachNewPassword();

    fireEvent.change(screen.getByLabelText("Yeni Şifre"), {
      target: { value: "GucluSifre1!" },
    });
    fireEvent.change(screen.getByLabelText("Şifreyi Tekrar Gir"), {
      target: { value: "BaskaSifre1!" },
    });

    const confirm = screen.getByLabelText("Şifreyi Tekrar Gir");
    const warning = screen.getByText("Şifreler eşleşmiyor");

    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect(confirm.getAttribute("aria-describedby")).toBe(warning.id);
  });

  it("şifre kuralları ilerlemesi ekran okuyucuya özetlenir", async () => {
    await reachNewPassword();

    fireEvent.change(screen.getByLabelText("Yeni Şifre"), {
      target: { value: "abc" },
    });
    expect(screen.getByText(/kurallarından 1 \/ 5/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Yeni Şifre"), {
      target: { value: "GucluSifre1!" },
    });
    expect(screen.getByText(/kurallarından 5 \/ 5/)).toBeInTheDocument();
  });

  it("3. adımda resetToken sunucuya gönderilir", async () => {
    await reachNewPassword();
    fetchMock.mockResolvedValueOnce(jsonResponse({ step: "success" }));

    fireEvent.change(screen.getByLabelText("Yeni Şifre"), {
      target: { value: "GucluSifre1!" },
    });
    fireEvent.change(screen.getByLabelText("Şifreyi Tekrar Gir"), {
      target: { value: "GucluSifre1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi Değiştir" }));

    await screen.findByText("Şifre Değiştirildi");
    const body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.resetToken).toBe("t".repeat(64));
    expect(body.newPassword).toBe("GucluSifre1!");
    // Sunucu 3. adımda cevapları yeniden doğruluyor — sözleşme korunmalı
    expect(body.answers).toHaveLength(2);
  });

  it("başarı ekranında adım göstergesi gizlenir", async () => {
    await reachNewPassword();
    fetchMock.mockResolvedValueOnce(jsonResponse({ step: "success" }));

    fireEvent.change(screen.getByLabelText("Yeni Şifre"), {
      target: { value: "GucluSifre1!" },
    });
    fireEvent.change(screen.getByLabelText("Şifreyi Tekrar Gir"), {
      target: { value: "GucluSifre1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Şifreyi Değiştir" }));

    await screen.findByText("Şifre Değiştirildi");
    expect(screen.queryByText(/adımdasınız/)).not.toBeInTheDocument();
  });
});
