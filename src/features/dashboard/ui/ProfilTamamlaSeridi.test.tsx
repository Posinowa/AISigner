// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

// DogrulamaYenidenGonder yönlendirici kullanıyor; jsdom'da app router yok.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
import { ProfilTamamlaSeridi } from "./ProfilTamamlaSeridi";

/**
 * #290 — idari işler şeridinin sözleşmesi.
 *
 * Asıl kusur bu işlerin HER ZAMAN görünmesiydi: hesabı tamam olan kullanıcı
 * da her girişte fotoğraf yükleme aracına ve doğrulama uyarısına bakıyordu.
 * Şerit yalnızca gerçekten eksik varken basılmalı.
 */

describe("ProfilTamamlaSeridi — görünürlük", () => {
  it("hiçbir eksik yokken HİÇ basılmaz", () => {
    const { container } = render(
      <ProfilTamamlaSeridi emailVerified={new Date().toISOString()} fotografVar />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("yalnızca e-posta eksikse tek madde gösterir", () => {
    render(<ProfilTamamlaSeridi emailVerified={null} fotografVar />);

    expect(screen.getByText(/doğrulanmadı/i)).toBeInTheDocument();
    expect(screen.queryByText(/Fotoğraf ekle/)).toBeNull();
  });

  it("yalnızca fotoğraf eksikse tek madde gösterir", () => {
    render(
      <ProfilTamamlaSeridi emailVerified={new Date().toISOString()} fotografVar={false} />,
    );

    expect(screen.getByText("Fotoğraf ekle")).toBeInTheDocument();
    expect(screen.queryByText(/doğrulanmadı/i)).toBeNull();
  });

  it("ikisi de eksikse ikisini de gösterir", () => {
    render(<ProfilTamamlaSeridi emailVerified={null} fotografVar={false} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("ProfilTamamlaSeridi — fotoğraf bağlantısı", () => {
  it("fotoğraf hedefi çağıran tarafından belirlenir", () => {
    // Stajyer panelinde sayfa içi çapa, mentörde ayrı bir sayfa.
    render(
      <ProfilTamamlaSeridi
        emailVerified={new Date().toISOString()}
        fotografVar={false}
        fotografCapasi="/profile-setup"
      />,
    );

    expect(screen.getByText("Fotoğraf ekle").closest("a")).toHaveAttribute(
      "href",
      "/profile-setup",
    );
  });
});
