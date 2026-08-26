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

describe("FormAlert — hata kutusunda başlık (#247)", () => {
  /**
   * `title` propu tipte her iki varyant için de tanımlıydı ama yalnızca
   * başarı dalında render ediliyordu. Doğrulama bağlantısının süresi
   * dolduğunda kullanıcı "süresi doldu" başlığını hiç görmüyordu.
   */
  it("hata kutusunda başlık gösterilir", () => {
    render(
      <FormAlert variant="error" title="Bağlantının süresi doldu">
        Yeni bir doğrulama e-postası isteyin.
      </FormAlert>,
    );

    expect(screen.getByText("Bağlantının süresi doldu")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Yeni bir doğrulama e-postası isteyin.",
    );
  });

  it("başlık verilmeyen hata kutusu değişmez — mevcut çağıranlar etkilenmez", () => {
    const { container } = render(
      <FormAlert variant="error">Sadece gövde</FormAlert>,
    );
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });
});
