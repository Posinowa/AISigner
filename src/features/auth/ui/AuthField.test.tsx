// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthField } from "./AuthField";

describe("AuthField — erişilebilirlik ve render (#153 / #160)", () => {
  it("etiket ve input'u doğru id ile bağlar", () => {
    render(<AuthField id="test-email" name="email" label="E-posta Adresi" placeholder="ornek@mail.com" />);

    const input = screen.getByLabelText("E-posta Adresi");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "test-email");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toHaveAttribute("placeholder", "ornek@mail.com");
  });

  it("hint metnini etiket yanında gösterir", () => {
    render(<AuthField id="test-phone" name="phone" label="Telefon" hint="(opsiyonel)" />);

    expect(screen.getByText("(opsiyonel)")).toBeInTheDocument();
  });

  it("hata olduğunda aria-invalid, aria-describedby ve role='alert' bağlar", () => {
    render(
      <AuthField
        id="test-name"
        name="name"
        label="Adınız"
        errors={["Ad alanı zorunludur."]}
      />,
    );

    const input = screen.getByLabelText("Adınız");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "test-name-error");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Ad alanı zorunludur.");
    expect(alert).toHaveAttribute("id", "test-name-error");
  });

  it("hata yokken aria-invalid ve aria-describedby eklemez", () => {
    render(<AuthField id="test-name" name="name" label="Adınız" />);

    const input = screen.getByLabelText("Adınız");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("belowField içeriğini render eder", () => {
    render(
      <AuthField
        id="test-pass"
        name="password"
        label="Şifre"
        belowField={<span data-testid="extra-content">Şifremi unuttum</span>}
      />,
    );

    expect(screen.getByTestId("extra-content")).toBeInTheDocument();
  });
});

describe("AuthField — revealable şifre göster/gizle (#153 / #169)", () => {
  it("revealable=true iken varsayılan tip 'password' olur ve toggle butonu sunar", () => {
    render(<AuthField id="pass" name="password" label="Şifre" revealable />);

    const input = screen.getByLabelText("Şifre");
    expect(input).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByRole("button", { name: "Şifreyi göster" });
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("toggle butonuna tıklandığında input tipi 'text' olur ve aria-pressed güncellenir", () => {
    render(<AuthField id="pass" name="password" label="Şifre" revealable />);

    const input = screen.getByLabelText("Şifre");
    const toggleBtn = screen.getByRole("button", { name: "Şifreyi göster" });

    fireEvent.click(toggleBtn);

    expect(input).toHaveAttribute("type", "text");
    expect(toggleBtn).toHaveAttribute("aria-label", "Şifreyi gizle");
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");

    // Tekrar tıklandığında password'e döner
    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute("type", "password");
    expect(toggleBtn).toHaveAttribute("aria-label", "Şifreyi göster");
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("revealable=true olduğunda dışarıdan geçilen type yok sayılır (yönetilen tip)", () => {
    render(<AuthField id="pass" name="password" label="Şifre" type="email" revealable />);

    const input = screen.getByLabelText("Şifre");
    expect(input).toHaveAttribute("type", "password");
  });
});
