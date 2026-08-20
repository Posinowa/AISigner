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
