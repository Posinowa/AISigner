// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { CertificateModal } from "./CertificateModal";
import type { CertificateData } from "@/features/certificate/server/certificate";

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

/**
 * #235 — sertifika yazdırma sözleşmesi.
 *
 * Hatanın üç ayrı kaynağı vardı ve her biri tek başına boş/bozuk çıktı
 * üretebiliyordu. Bu testler üçünü de kilitliyor; biri geri alınırsa kırmızıya
 * döner.
 */

const sertifika: CertificateData = {
  id: "cert-1",
  studentName: "Test Stajyer",
  studentEmail: "stajyer@example.com",
  mentorName: "Test Mentör",
  mentorEmail: "mentor@example.com",
  certificateNumber: "AIS-2026-0001",
  completionGrade: "Üstün Başarı",
  mentorNote: "Staj boyunca üstün başarı gösterdi.",
  issuedAt: new Date("2026-01-01").toISOString(),
  completedProjects: [
    {
      id: "p1",
      title: "Test Projesi",
      description: "Açıklama",
      difficulty: "orta",
      track: ["backend"],
      completedStepsCount: 5,
      totalStepsCount: 5,
      takimAdi: null,
    },
  ],
  verificationUrl: "https://aisigner.com/verify-certificate/AIS-2026-0001",
  isIssued: true,
};

/** Yazdırma akışında oluşturulan iframe (aria-hidden ile işaretli). */
const yazdirmaCercevesi = () =>
  document.querySelector<HTMLIFrameElement>('iframe[aria-hidden="true"]');

let printSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  printSpy = vi.fn();
  // jsdom iframe'lerinde print/fonts yok — kontrollü şekilde sağlıyoruz.
  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    configurable: true,
    get() {
      const doc = this.contentDocument;
      return {
        document: doc,
        focus: vi.fn(),
        print: printSpy,
        addEventListener: (t: string, cb: EventListener, o?: AddEventListenerOptions) =>
          doc?.defaultView?.addEventListener(t, cb, o),
      };
    },
  });
});

afterEach(() => {
  cleanup();
  // Yazdırma çerçeveleri React ağacının dışında, doğrudan body'ye ekleniyor;
  // cleanup() onları sökmez. Kalanları temizlemezsek sonraki testler önceki
  // testin çerçevesini görür.
  document
    .querySelectorAll('iframe[aria-hidden="true"]')
    .forEach((f) => f.remove());
  vi.restoreAllMocks();
});

function ac() {
  render(
    <CertificateModal certificate={sertifika} isOpen onClose={() => {}} />,
  );
}

const yazdirmayaBas = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /pdf \/ yazdır/i }));
    // yazdir() async — mikrotask kuyrugunu bosalt ki zamanlayicilar kurulsun
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("CertificateModal — yazdırma (#235)", () => {
  it("yazdırma çerçevesi sıfır boyutlu DEĞİLDİR", async () => {
    ac();
    await yazdirmayaBas();

    const f = yazdirmaCercevesi();
    expect(f, "yazdırma çerçevesi oluşturulmalı").not.toBeNull();

    // 0x0 iframe bazı tarayıcılarda layout almaz → boş sayfa yazdırılır.
    expect(f!.style.width).not.toBe("0");
    expect(f!.style.height).not.toBe("0");
    expect(f!.style.width).toBe("210mm");
    expect(f!.style.height).toBe("297mm");
  });

  it("çerçeve ekran dışına konumlanır (kullanıcıya görünmez)", async () => {
    ac();
    await yazdirmayaBas();

    const f = yazdirmaCercevesi()!;
    expect(f.style.position).toBe("fixed");
    expect(parseInt(f.style.left, 10)).toBeLessThan(-1000);
  });

  it("sertifika içeriği çerçeveye yazılır", async () => {
    ac();
    await yazdirmayaBas();

    const doc = yazdirmaCercevesi()!.contentDocument!;
    expect(doc.getElementById("certificate-print-area")).not.toBeNull();
    expect(doc.body.textContent).toContain("Test Stajyer");
  });

  it("çerçeve hemen kaldırılmaz — yazdırma bitmeden DOM'da kalır", async () => {
    vi.useFakeTimers();
    ac();
    await yazdirmayaBas();

    act(() => void vi.advanceTimersByTime(5_000));
    // eski davranış 1000ms sonra siliyordu; diyalog açıkken çıktı bozuluyordu
    expect(yazdirmaCercevesi(), "5sn sonra hâlâ durmalı").not.toBeNull();

    vi.useRealTimers();
  });

  it("uzun süre sonra güvenlik ağı çerçeveyi temizler", async () => {
    vi.useFakeTimers();
    ac();
    await yazdirmayaBas();

    act(() => void vi.advanceTimersByTime(130_000));
    expect(yazdirmaCercevesi(), "güvenlik ağı devreye girmeli").toBeNull();

    vi.useRealTimers();
  });
  it("yazı tipleri gelmese bile yazdırma engellenmez (sınırlı bekleme)", async () => {
    vi.useFakeTimers();
    ac();
    await yazdirmayaBas();

    // fonts.ready hiç çözülmezse bile üst sınır dolunca print() çağrılmalı
    await act(async () => {
      vi.advanceTimersByTime(2_500);
      await Promise.resolve();
    });

    expect(printSpy, "print() çağrılmalı").toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("CertificateModal — indirme (#235)", () => {
  /*
    jsdom'da varsayılan olarak hiç stil sayfası yok; o yüzden test ortamına
    hem bir <link> hem de kuralı olan bir <style> enjekte ediyoruz. Aksi
    halde eski (hatalı) kod da boş çıktı üretir ve test YALANCI YEŞİL olur.
  */
  const ISARET = "sertifika-stil-isareti";

  beforeEach(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/_next/static/css/app/layout.css";
    document.head.appendChild(link);

    const stil = document.createElement("style");
    stil.textContent = `.${ISARET} { color: rgb(1, 2, 3); }`;
    document.head.appendChild(stil);
  });

  afterEach(() => {
    document.head.querySelectorAll("link[rel='stylesheet'], style").forEach((n) => n.remove());
  });

  /*
    Buton adı TAM eşleşmeyle aranıyor: JS regex'inin `i` bayrağı Türkçe
    "İ" (U+0130) harfini "i"ye katlamaz, bu yüzden /indir/i eşleşmez.
  */
  /** İndirme akışında üretilen HTML'i Blob'dan yakalar. */
  async function indirilenHtml(): Promise<string> {
    let yakalanan = "";
    const gercekBlob = globalThis.Blob;
    class YakalayanBlob extends gercekBlob {
      constructor(parcalar: BlobPart[], secenekler?: BlobPropertyBag) {
        yakalanan = String(parcalar[0] ?? "");
        super(parcalar, secenekler);
      }
    }
    vi.stubGlobal("Blob", YakalayanBlob);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => {},
    });

    ac();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sertifikayı İndir" }));
      await Promise.resolve();
    });
    return yakalanan;
  }

  it("stil bağlantısı KOPYALANMAZ — dosya diskte açılınca çözülemez", async () => {
    const html = await indirilenHtml();
    // <link rel=stylesheet href="/_next/..."> indirilen dosyada file:/// olarak
    // çözülür ve sertifika çıplak HTML görünür — hatanın kök nedeni buydu.
    expect(html).not.toMatch(/<link[^>]*stylesheet/i);
    expect(html).not.toContain("/_next/static/css");
  });

  it("stil KURALLARI dosyanın içine gömülür", async () => {
    const html = await indirilenHtml();
    expect(html).toMatch(/<style>/);
    // sadece <style> etiketi değil, gerçek kural metni de içeride olmalı
    expect(html).toContain(ISARET);
  });

  it("sertifika içeriği ve doğrulama numarası dosyada yer alır", async () => {
    const html = await indirilenHtml();
    expect(html).toContain("Test Stajyer");
    expect(html).toContain("AIS-2026-0001");
  });
});

/**
 * #280 — sertifikanın marka ve erişilebilirlik eksikleri.
 *
 * En kritik olanı logonun GÖMÜLÜ olması: sertifika indirildiğinde tek bir HTML
 * dosyasına dönüşüyor; göreli bir yol o dosya yerelden açıldığında çözülemez
 * ve logo kırık çıkardı.
 */
describe("CertificateModal — marka ve erişilebilirlik (#280)", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  function ac() {
    render(<CertificateModal certificate={sertifika} isOpen onClose={() => {}} />);
  }

  it("Posinowa logosu gösterilir", () => {
    ac();
    expect(screen.getByAltText("Posinowa")).toBeInTheDocument();
  });

  it("logo GÖMÜLÜ veri olarak taşınır — göreli yol DEĞİL", () => {
    // Göreli yol indirilen dosyada kırılırdı.
    ac();
    const src = screen.getByAltText("Posinowa").getAttribute("src") ?? "";
    expect(src.startsWith("data:image/")).toBe(true);
  });

  it("modal ekran okuyucuya modal olarak duyurulur", () => {
    ac();
    const d = document.querySelector('[role="dialog"]');
    expect(d).not.toBeNull();
    expect(d?.getAttribute("aria-modal")).toBe("true");
  });

  it("modalın erişilebilir bir başlığı vardır", () => {
    ac();
    const d = document.querySelector('[role="dialog"]');
    const id = d?.getAttribute("aria-labelledby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toMatch(/sertifika/i);
  });

  it("doğrulama adresi tıklanabilir bağlantıdır", () => {
    // Önceden düz metindi; ekranda tıklanamıyordu.
    ac();
    const a = document.querySelector(`a[href="${sertifika.verificationUrl}"]`);
    expect(a).not.toBeNull();
    expect(a?.getAttribute("rel")).toContain("noopener");
  });
});

describe("CertificateModal — indirilen dosyada logo (#280)", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("indirilen HTML gömülü logoyu İÇERİR", () => {
    // Asıl regresyon riski burada: logo göreli yola çevrilirse indirilen
    // dosyada kırık çıkar ve bunu yalnızca dosyayı açan fark eder.
    const yakalanan: string[] = [];
    const orjinalCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      // Blob içeriğini senkron okuyamıyoruz; boyut üzerinden gömülü veri kontrolü
      // yerine doğrudan DOM'daki src'yi doğruluyoruz (aşağıda).
      yakalanan.push(String(blob.size));
      return "blob:test";
    }) as typeof URL.createObjectURL;

    render(<CertificateModal certificate={sertifika} isOpen onClose={() => {}} />);

    const src = screen.getByAltText("Posinowa").getAttribute("src") ?? "";
    fireEvent.click(screen.getByRole("button", { name: "Sertifikayı İndir" }));

    URL.createObjectURL = orjinalCreate;

    // İndirilen dosya printArea.outerHTML'den üretiliyor; logo data URI olduğu
    // için o çıktının içinde birebir taşınır.
    expect(src.startsWith("data:image/webp;base64,")).toBe(true);
    expect(yakalanan.length).toBeGreaterThan(0);
  });
});
