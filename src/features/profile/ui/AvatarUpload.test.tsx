// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * #265 — yükleme bileşeni.
 *
 * Sunucu hatası kullanıcıya AÇIKÇA gösterilmeli: "resim değil" gibi bir
 * mesaj sessizce yutulursa kullanıcı neden başarısız olduğunu anlamaz.
 */

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));

import { AvatarUpload } from "./AvatarUpload";

const dosyaSec = (icerik = "veri", ad = "foto.png") => {
  const input = screen.getByLabelText(/profil fotoğrafı seç/i) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File([icerik], ad, { type: "image/png" })] },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }),
  );
});

describe("AvatarUpload — fotoğraf yokken", () => {
  it("yükle butonu gösterilir", () => {
    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar={false} />);
    expect(screen.getByRole("button", { name: /fotoğraf yükle/i })).toBeInTheDocument();
  });

  it("kaldır butonu GÖSTERİLMEZ", () => {
    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar={false} />);
    expect(screen.queryByRole("button", { name: /kaldır/i })).toBeNull();
  });
});

describe("AvatarUpload — yükleme", () => {
  it("dosya seçilince yükleme isteği atılır", async () => {
    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar={false} />);
    dosyaSec();

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/profile/avatar",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("başarıda kaldır butonu belirir", async () => {
    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar={false} />);
    dosyaSec();

    expect(
      await screen.findByRole("button", { name: /kaldır/i }),
    ).toBeInTheDocument();
  });

  it("sunucunun red gerekçesi kullanıcıya gösterilir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Bu dosya bir resim değil." }),
      }),
    );

    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar={false} />);
    dosyaSec("<script>alert(1)</script>", "sahte.png");

    expect(await screen.findByText(/bir resim değil/i)).toBeInTheDocument();
  });

  it("hata sonrası fotoğraf VAR sayılmaz", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "hata" }) }),
    );

    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar={false} />);
    dosyaSec();

    await screen.findByText("hata");
    expect(screen.queryByRole("button", { name: /kaldır/i })).toBeNull();
  });

  it("ağ hatası çökmeye yol açmaz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar={false} />);
    dosyaSec();

    expect(await screen.findByText(/bağlantı hatası/i)).toBeInTheDocument();
  });
});

describe("AvatarUpload — kaldırma", () => {
  it("DELETE isteği atılır", async () => {
    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar />);
    fireEvent.click(screen.getByRole("button", { name: /kaldır/i }));

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/profile/avatar",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("kaldırınca yükle butonuna dönülür", async () => {
    render(<AvatarUpload userId="k1" basHarfler="AY" fotografVar />);
    fireEvent.click(screen.getByRole("button", { name: /kaldır/i }));

    expect(
      await screen.findByRole("button", { name: /fotoğraf yükle/i }),
    ).toBeInTheDocument();
  });
});
