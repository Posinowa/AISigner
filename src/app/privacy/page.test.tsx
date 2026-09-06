// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

/**
 * #449 — KVKK aydınlatma metni.
 *
 * ⚠️ İKİ DURUM DA TEST EDİLİYOR: bilgiler girilmeden önce ve girildikten
 * sonra. Yalnız birini test etmek, sayfanın diğer durumda ne gösterdiğini
 * kimsenin bilmemesi demekti — ve bu, HERKESE AÇIK bir hukuki metin.
 *
 * ⚠️ EN KRİTİK İDDİA: bilgiler girilmemişken sayfa UYDURMA bir unvan/adres
 * göstermemeli. Yanlış bir başvuru kanalı, eksik bilgiden daha zararlıdır:
 * kullanıcı ona güvenip başvurur ve başvurusu hiçbir yere ulaşmaz.
 */
afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/features/legal/kvkk");
});

async function sayfayiBas() {
  const { default: PrivacyPage } = await import("./page");
  return render(<PrivacyPage />);
}

describe("bilgiler HENÜZ GİRİLMEMİŞKEN", () => {
  it("eksikliği açıkça söyleyen bir uyarı gösterir", async () => {
    await sayfayiBas();

    expect(
      screen.getByText(/Bu metnin bir bölümü tamamlanma aşamasındadır/),
    ).toBeInTheDocument();
  });

  it("uyarı HANGİ başlıkların eksik olduğunu sayar", async () => {
    await sayfayiBas();

    const uyari = screen.getByText(/Aşağıdaki başlıklarda yer alacak bilgiler/);
    expect(uyari.textContent).toContain("Veri Sorumlusu");
    expect(uyari.textContent).toContain("Başvuru Yolu");
    expect(uyari.textContent).toContain("Saklama Süreleri");
  });

  it("⚠️ UYDURMA veri basılmaz — MERSİS/adres satırı hiç render edilmez", async () => {
    await sayfayiBas();

    expect(screen.queryByText(/MERSİS numarası:/)).toBeNull();
    expect(screen.queryByText(/Ticari unvan:/)).toBeNull();
  });

  it("geçici başvuru yolu yine de gösterilir — kullanıcı yolsuz kalmaz", async () => {
    await sayfayiBas();

    expect(
      screen.getAllByText(/platform üzerinden yöneticinize/).length,
    ).toBeGreaterThan(0);
  });
});

describe("bilgiler GİRİLDİKTEN sonra", () => {
  async function doluSayfa() {
    vi.doMock("@/features/legal/kvkk", () => ({
      VERI_SORUMLUSU: {
        unvan: "Örnek Yazılım A.Ş.",
        adres: "Örnek Mah. Test Sok. No:1 İstanbul",
        mersis: "0123456789012345",
        basvuruKanali: "kvkk@ornek.com",
      },
      SAKLAMA_SURELERI: [
        { kategori: "Hesap bilgileri", sure: "Hesap silinene kadar" },
      ],
      // #519: Bu blok şirket bilgilerini test ediyor; hata teşhis bölümü
      // kendi describe'ında ayrıca kapsanıyor.
      HATA_TESHIS: null,
      eksikAlanlar: () => [],
    }));
    return sayfayiBas();
  }

  it("uyarı KAYBOLUR — metne dokunmaya gerek kalmadan", async () => {
    await doluSayfa();

    expect(
      screen.queryByText(/tamamlanma aşamasındadır/),
    ).toBeNull();
  });

  it("veri sorumlusu bilgileri yayımlanır", async () => {
    await doluSayfa();

    expect(screen.getByText(/Örnek Yazılım A.Ş./)).toBeInTheDocument();
    expect(screen.getByText(/0123456789012345/)).toBeInTheDocument();
  });

  it("başvuru kanalı Başvuru Yolu bölümünde de görünür", async () => {
    await doluSayfa();

    expect(screen.getAllByText(/kvkk@ornek.com/).length).toBeGreaterThan(0);
  });

  it("saklama süreleri listelenir", async () => {
    await doluSayfa();

    expect(screen.getByText(/Hesap silinene kadar/)).toBeInTheDocument();
  });
});

describe("kanunda SABİT olan kısım — her durumda yayımlanır", () => {
  it("KVKK m.11 haklarının dokuzu da sayılır", async () => {
    await sayfayiBas();

    for (const hak of [
      /işlenip işlenmediğini öğrenme/,
      /buna ilişkin bilgi talep etme/,
      /amacına uygun kullanılıp/,
      /aktarıldığı üçüncü kişileri bilme/,
      /düzeltilmesini isteme/,
      /silinmesini veya yok edilmesini isteme/,
      /üçüncü kişilere bildirilmesini isteme/,
      /münhasıran otomatik sistemler/,
      /zararın giderilmesini talep etme/,
    ]) {
      expect(screen.getByText(hak)).toBeInTheDocument();
    }
  });

  it("m.13 otuz günlük süre ve ücretsizlik yazılı", async () => {
    await sayfayiBas();

    expect(screen.getByText(/en geç otuz gün/)).toBeInTheDocument();
    expect(screen.getByText(/ücretsiz olarak sonuçlandırılır/)).toBeInTheDocument();
  });

  it("m.14 şikâyet yolu ve süreleri yazılı", async () => {
    await sayfayiBas();

    const p = screen.getByText(/Kişisel Verileri Koruma Kuruluna şikâyette/);
    expect(p.textContent).toMatch(/otuz/);
    expect(p.textContent).toMatch(/altmış gün/);
  });

  it("⚠️ ÇEREZ bölümü KODDAN doğrulanan olguyu söyler", async () => {
    // Tarandı: analitik/izleme betiği yok, localStorage kullanılmıyor.
    // Bu cümle kodla birlikte yanlışlanabilir olmalı — biri analitik
    // eklerse metin de güncellenmeli.
    await sayfayiBas();

    // `getByText` <strong>'u döndürüyor; iddia PARAGRAFIN tamamına ait.
    const cerez = screen.getByText(/yalnızca zorunlu çerezler/i).closest("p");
    expect(cerez?.textContent).toMatch(/analitik/);
    expect(cerez?.textContent).toMatch(/localStorage/);
  });

  it("yurt dışına aktarımın AÇIK RIZAYA bağlı olduğu ve geri alınabildiği yazılı", async () => {
    await sayfayiBas();

    expect(screen.getByText(/Amerika Birleşik Devletleri/)).toBeInTheDocument();
    expect(screen.getByText(/türev analizleriniz/)).toBeInTheDocument();
  });
});

describe("canlı testte bulunan kusurlar (#453)", () => {
  it("⚠️ uyarı metninde FİİL TEKRARI yok", async () => {
    // "yöneticinize ileterek iletebilirsiniz" — tarayıcıda okununca görüldü.
    // Testler metnin VARLIĞINI ölçüyordu, OKUNABİLİRLİĞİNİ değil.
    await sayfayiBas();

    expect(screen.getByText(/Aşağıdaki başlıklarda/).textContent).not.toMatch(
      /ileterek iletebilirsiniz/,
    );
  });
});

/**
 * #519 — hata teşhis hizmeti (üçüncü tarafa aktarım).
 *
 * ⚠️ METİN İLE KOD BİRBİRİNE BAĞLI: `lib/sentry.ts` bu alan `null` iken
 * DSN tanımlı olsa bile kendini açmıyor. Yani "hizmet açık ama metinde
 * yazılı değil" durumu OLUŞAMAZ. Test iki durumu da kilitliyor; yalnız
 * birini test etmek, sayfanın diğer durumda ne gösterdiğini kimsenin
 * bilmemesi olurdu — ve bu herkese açık bir hukuki metin.
 */
describe("hata teşhis hizmeti (#519)", () => {
  async function saglayiciyla(hataTeshis: unknown) {
    vi.doMock("@/features/legal/kvkk", () => ({
      VERI_SORUMLUSU: null,
      SAKLAMA_SURELERI: null,
      HATA_TESHIS: hataTeshis,
      eksikAlanlar: () => [],
    }));
    return sayfayiBas();
  }

  it("kullanılmıyorsa bölüm HİÇ yazılmaz — olmayan bir aktarım beyan edilmez", async () => {
    await saglayiciyla(null);

    expect(screen.queryByText(/teknik hataların teşhisi/i)).not.toBeInTheDocument();
  });

  it("kullanılıyorsa hizmetin ADI ve BÖLGESİ yazılır", async () => {
    await saglayiciyla({ ad: "Sentry", bolge: "AB", gizlilikUrl: "https://x.test" });

    expect(screen.getByText(/teknik hataların teşhisi/i)).toBeInTheDocument();
    expect(screen.getByText("Sentry")).toBeInTheDocument();
  });

  /*
   * ⚠️ NE GÖNDERİLMEDİĞİ DE YAZILI OLMALI. "Hata kayıtları gönderilir"
   * demek, kullanıcıya isteğinin tamamının gittiğini düşündürür; ayıklama
   * `lib/sentry.ts`'te yapılıyor ve metin bunu SÖYLEMEZSE koruma
   * kullanıcının bilgisi dışında kalır.
   */
  it("⚠️ gönderilmeyenleri açıkça sayar — IP, çerez, gövde, hesap bilgisi", async () => {
    await saglayiciyla({ ad: "Sentry", bolge: "AB", gizlilikUrl: "https://x.test" });

    const metin = document.body.textContent ?? "";
    for (const beklenen of ["gövdesi", "çerezler", "IP adresiniz", "hesap bilgileriniz"]) {
      expect(metin).toContain(beklenen);
    }
  });

  /*
   * ⚠️ ÇEREZ BÖLÜMÜNÜN İDDİASI KORUNMALI. Sayfa "üçüncü taraf betiği
   * çalıştırılmaz" diyor ve bu, tarayıcı SDK'sının BİLEREK eklenmemesinin
   * sebebi. Biri istemci tarafı Sentry eklerse bu cümle yalan olur.
   */
  it("⚠️ teşhisin YALNIZ SUNUCUDA yapıldığı yazılı kalır", async () => {
    await saglayiciyla({ ad: "Sentry", bolge: "AB", gizlilikUrl: "https://x.test" });

    const metin = document.body.textContent ?? "";
    expect(metin).toContain("üçüncü taraf betiği");
    expect(metin).toContain("yalnızca sunucu tarafında");
  });
});
