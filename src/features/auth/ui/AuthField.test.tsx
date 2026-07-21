// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthField } from "./AuthField";

describe("AuthField erişilebilirlik (#153)", () => {
  it("hatasızken aria-invalid işaretlenmez", () => {
    render(<AuthField id="f" name="f" label="E-posta" />);

    const input = screen.getByLabelText("E-posta");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("hata varsa input aria-invalid olur ve hata metnine bağlanır", () => {
    render(<AuthField id="f" name="f" label="E-posta" errors={["Geçersiz e-posta"]} />);

    const input = screen.getByLabelText("E-posta");
    const error = screen.getByText("Geçersiz e-posta");

    expect(input).toHaveAttribute("aria-invalid", "true");
    // Bağlantı gerçekten kuruluyor mu: describedby, hata elemanının id'sini göstermeli
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(error.id).toBeTruthy();
  });

  it("hata role='alert' ile duyurulur", () => {
    render(<AuthField id="f" name="f" label="Şifre" errors={["Şifre hatalı"]} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Şifre hatalı");
  });

  it("etiket input'a bağlıdır (htmlFor/id eşleşir)", () => {
    render(<AuthField id="ozel-id" name="f" label="Telefon" />);

    expect(screen.getByLabelText("Telefon")).toHaveAttribute("id", "ozel-id");
  });

  it("revealable alan varsayılan olarak gizlidir ve düğmeyle açılır", () => {
    render(<AuthField id="p" name="password" label="Şifre" revealable />);

    const input = screen.getByLabelText("Şifre");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Şifreyi göster" }));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Şifreyi gizle" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("göster/gizle düğmesi formu göndermez (type=button)", () => {
    render(<AuthField id="p" name="password" label="Şifre" revealable />);

    expect(screen.getByRole("button", { name: "Şifreyi göster" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("hint etiketin yanında gösterilir", () => {
    render(<AuthField id="t" name="phone" label="Telefon" hint="(opsiyonel)" />);

    expect(screen.getByText(/opsiyonel/)).toBeInTheDocument();
  });
});
