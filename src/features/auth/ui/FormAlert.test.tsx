// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { FormAlert } from "./FormAlert";

describe("FormAlert (#153)", () => {
  it("hata kutusu role='alert' ile anında duyurulur", () => {
    render(<FormAlert variant="error">E-posta veya şifre hatalı!</FormAlert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("E-posta veya şifre hatalı!");
  });

  it("başarı kutusu role='status' kullanır — kullanıcının işini bölmez", () => {
    render(
      <FormAlert variant="success" title="Hesabınız oluşturuldu!">
        Şimdi giriş yapabilirsiniz.
      </FormAlert>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Şimdi giriş yapabilirsiniz.");
    // Başarı mesajı alert olarak duyurulmamalı
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("başarı kutusunda başlık gösterilir", () => {
    render(
      <FormAlert variant="success" title="Hesabınız oluşturuldu!">
        Devam edin.
      </FormAlert>,
    );

    expect(screen.getByText("Hesabınız oluşturuldu!")).toBeInTheDocument();
  });
});
