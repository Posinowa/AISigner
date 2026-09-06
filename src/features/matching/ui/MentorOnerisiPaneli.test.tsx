// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * #328 — öneri paneli.
 *
 * Kilitlenen iki davranış:
 *   1. Panel YÜZDE göstermez, bant gösterir (yanlış kesinlik hissi vermesin).
 *   2. Atadıktan sonra düğme "Atanmış"a döner — aksi halde admin aynı mentörü
 *      atadığını fark etmeden ikinci kez tıklar.
 */

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { MentorOnerisiPaneli, elemeCumlesi } from "./MentorOnerisiPaneli";

const yanit = (govde: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: async () => govde });

const SONUC = {
  oneriler: [
    {
      mentorId: "m1",
      ad: "Ayşe",
      soyad: "Yılmaz",
      email: "m1@ornek.test",
      uyum: "guclu",
      gerekce: "Backend hedefleriyle örtüşüyor",
      cekince: null,
      zatenAtanmis: false,
    },
  ],
  degerlendirilen: 2,
  analiziOlmayan: 0,
  rizasiOlmayan: 0,
};

function panelCiz(props: Partial<React.ComponentProps<typeof MentorOnerisiPaneli>> = {}) {
  return render(
    <MentorOnerisiPaneli
      studentId="u1"
      ogrenciAdi="Student User"
      atamaSuruyor={false}
      onAta={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("öneri gösterimi", () => {
  it("bant gösterir, YÜZDE göstermez", async () => {
    vi.stubGlobal("fetch", yanit(SONUC));
    panelCiz();

    fireEvent.click(screen.getByRole("button", { name: /AI mentör önerisi/i }));

    expect(await screen.findByText("Güçlü uyum")).toBeInTheDocument();
    // Panelde hiçbir yerde yüzde işareti olmamalı.
    expect(document.body.textContent).not.toMatch(/%\s*\d/);
  });

  it("gerekçeyi ve eleme sayılarını gösterir", async () => {
    vi.stubGlobal("fetch", yanit({ ...SONUC, degerlendirilen: 1, rizasiOlmayan: 2 }));
    panelCiz();

    fireEvent.click(screen.getByRole("button", { name: /AI mentör önerisi/i }));

    expect(await screen.findByText(/Backend hedefleriyle örtüşüyor/)).toBeInTheDocument();
    // "En uygun mentör", adaylar elenmişken yanıltıcı olur.
    expect(screen.getByText(/2 mentör yapay zekâ onayı olmadığı için/)).toBeInTheDocument();
  });

  it("çekinceyi gösterir", async () => {
    vi.stubGlobal(
      "fetch",
      yanit({
        ...SONUC,
        oneriler: [{ ...SONUC.oneriler[0], cekince: "Frontend tarafında rehberlik edemez" }],
      }),
    );
    panelCiz();

    fireEvent.click(screen.getByRole("button", { name: /AI mentör önerisi/i }));

    expect(await screen.findByText(/Frontend tarafında rehberlik edemez/)).toBeInTheDocument();
  });

  it("boş öneri listesi hata gibi gösterilmez", async () => {
    // Model bilerek boş dönebilir ("zayıf adayları öne sürme").
    vi.stubGlobal("fetch", yanit({ ...SONUC, oneriler: [] }));
    panelCiz();

    fireEvent.click(screen.getByRole("button", { name: /AI mentör önerisi/i }));

    expect(await screen.findByText(/Uygun bir eşleşme bulunamadı/)).toBeInTheDocument();
  });
});

describe("atama", () => {
  it("atadıktan sonra düğme 'Atanmış'a döner", async () => {
    // Panel yeniden veri ÇEKMİYOR (yeni bir ücretli AI çağrısı olurdu), o yüzden
    // işaretlemeyi kendisi yapmalı. Yapmazsa admin aynı mentöre tekrar tıklar.
    const onAta = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", yanit(SONUC));
    panelCiz({ onAta });

    fireEvent.click(screen.getByRole("button", { name: /AI mentör önerisi/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Ata" }));

    await waitFor(() => expect(onAta).toHaveBeenCalledWith("m1"));
    expect(await screen.findByText("Atanmış")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ata" })).not.toBeInTheDocument();
  });

  it("zaten atanmış mentöre 'Ata' düğmesi göstermez", async () => {
    vi.stubGlobal(
      "fetch",
      yanit({ ...SONUC, oneriler: [{ ...SONUC.oneriler[0], zatenAtanmis: true }] }),
    );
    panelCiz();

    fireEvent.click(screen.getByRole("button", { name: /AI mentör önerisi/i }));

    expect(await screen.findByText("Atanmış")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ata" })).not.toBeInTheDocument();
  });
});

describe("hata durumu", () => {
  it("uç hata dönerse panel açık kalmaz", async () => {
    vi.stubGlobal("fetch", yanit({ error: "Rıza yok." }, false, 403));
    panelCiz();

    fireEvent.click(screen.getByRole("button", { name: /AI mentör önerisi/i }));

    await waitFor(() =>
      expect(screen.queryByText(/için öneriler/)).not.toBeInTheDocument(),
    );
  });
});

/**
 * #501 — kapsam cümlesi.
 *
 * ⚠️ NEDEN SAF FONKSİYONA ÇIKARILDI: cümle JSX içinde koşullu parçalarla
 * kuruluyordu ve iki gerekçeyle bile virgülü elle yönetiyordu. Üçüncü gerekçe
 * eklenince kombinasyon sayısı ikiye katlandı; JSX'te sessizce bozulan bir
 * cümleyi hiçbir test görmezdi.
 */
describe("elemeCumlesi", () => {
  it("eleme yoksa yalnız değerlendirilen sayısı", () => {
    expect(elemeCumlesi({ degerlendirilen: 3, analiziOlmayan: 0, rizasiOlmayan: 0 })).toBe(
      "3 mentör değerlendirildi",
    );
  });

  it("tek gerekçe: virgül YOK", () => {
    const c = elemeCumlesi({ degerlendirilen: 1, analiziOlmayan: 2, rizasiOlmayan: 0 });

    expect(c).toContain("2 mentör AI analizi olmadığı için");
    expect(c).toContain("kapsam dışı");
    expect(c).not.toContain(",");
  });

  it("üç gerekçe birden: hepsi görünür, aralarında virgül", () => {
    const c = elemeCumlesi({
      degerlendirilen: 1,
      analiziOlmayan: 2,
      rizasiOlmayan: 3,
      yedekAnalizli: 4,
    });

    expect(c).toContain("2 mentör AI analizi olmadığı için");
    expect(c).toContain("3 mentör yapay zekâ onayı olmadığı için");
    expect(c).toContain("4 mentör analizi yapay zekâ tarafından üretilmediği için");
    expect(c.split(",")).toHaveLength(3);
  });

  /*
   * ⚠️ "Analizi yok" ile aynı kefeye konamaz: kayıt VAR, içeriği uydurma.
   * Çözümü de farklı — analizi yeniden üretmek. Tek bir "elendi" sayısı
   * admin'i yanlış yere bakmaya iterdi.
   */
  it("⚠️ yedek gerekçesi 'analizi yok'tan AYRI cümle parçası", () => {
    const yedek = elemeCumlesi({
      degerlendirilen: 1,
      analiziOlmayan: 0,
      rizasiOlmayan: 0,
      yedekAnalizli: 2,
    });
    const yok = elemeCumlesi({ degerlendirilen: 1, analiziOlmayan: 2, rizasiOlmayan: 0 });

    expect(yedek).not.toBe(yok);
    expect(yedek).toContain("üretilmediği için");
  });

  it("alan hiç gelmezse (eski sunucu yanıtı) çökmez", () => {
    expect(() =>
      elemeCumlesi({ degerlendirilen: 1, analiziOlmayan: 0, rizasiOlmayan: 0 }),
    ).not.toThrow();
  });
});
