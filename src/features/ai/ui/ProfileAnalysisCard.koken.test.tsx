// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

import { ProfileAnalysisCard, type ProfileAnalysisData } from "./ProfileAnalysisCard";
import { PROMPT_SURUMU, YEDEK_SURUM, YEDEK_MODEL } from "@/lib/ai/uretim-kokeni";

/**
 * #501 — kökenin KARTTA görünmesi.
 *
 * ⚠️ Metnin kendisi `koken-etiketi.test.ts`'te kilitli. Burada kilitlenen
 * ayrı bir şey: kartın o metni GERÇEKTEN ÇİZDİĞİ. #494 kökeni veritabanına
 * yazmıştı ve tüm testleri geçiyordu — eksik olan tam da bu adımdı.
 */

const ANALIZ: ProfileAnalysisData = {
  level: "Orta",
  summary: "Öğrenci backend'e ilgili.",
  strengths: ["meraklı"],
  developmentAreas: ["test"],
  technicalTracks: ["backend"],
  recommendedPath: "Önce veri modeli",
  recommendations: ["Küçük bir API yaz"],
};

describe("ProfileAnalysisCard — üretim kökeni", () => {
  it("⚠️ yedek içerikte kart, metnin AI ÜRETMEDİĞİNİ yazar", () => {
    render(
      <ProfileAnalysisCard
        analysis={{ ...ANALIZ, uretimSurumu: YEDEK_SURUM, uretimModeli: YEDEK_MODEL }}
      />,
    );

    expect(screen.getByText(/Yapay zekâ üretmedi/i)).toBeInTheDocument();
    expect(screen.getByText(/model yanıt vermediği için/i)).toBeInTheDocument();
  });

  /*
   * ⚠️ SIRA ÖNEMLİ: uyarı içeriğin ÜSTÜNDE olmalı. Altta olsaydı okuyan kişi
   * metni önce değerlendirme olarak okur, uyarıyı sonra görürdü — yedek
   * içerikte bu, uyarının hiç olmamasıyla neredeyse aynı şey.
   */
  it("⚠️ köken şeridi ÖZETTEN ÖNCE gelir", () => {
    const { container } = render(
      <ProfileAnalysisCard
        analysis={{ ...ANALIZ, uretimSurumu: YEDEK_SURUM, uretimModeli: YEDEK_MODEL }}
      />,
    );

    const koken = screen.getByText(/Yapay zekâ üretmedi/i);
    const ozet = screen.getByText(ANALIZ.summary);

    expect(container.contains(koken)).toBe(true);
    expect(koken.compareDocumentPosition(ozet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("güncel kökende model ve sürüm okunur", () => {
    render(
      <ProfileAnalysisCard
        analysis={{ ...ANALIZ, uretimSurumu: PROMPT_SURUMU, uretimModeli: "gemini-2.5-flash" }}
      />,
    );

    expect(screen.getByText(/gemini-2\.5-flash/)).toBeInTheDocument();
  });

  /*
   * ⚠️ KÖKEN ALANI HİÇ GELMESE DE ŞERİT ÇİZİLİR. Yalnız sorunlu durumları
   * göstermek, işaretin YOKLUĞUNU iki anlama gelir hâle getirirdi: "her şey
   * yolunda" ile "bu kart kökeni hiç göstermiyor".
   */
  it("⚠️ köken yoksa şerit yine çizilir — 'kayıtlı değil' der", () => {
    render(<ProfileAnalysisCard analysis={ANALIZ} />);

    expect(screen.getByText(/Kaynağı bilinmiyor/i)).toBeInTheDocument();
  });

  it("analiz yokken şerit çizilmez — boş durumda anlatacak köken yok", () => {
    render(<ProfileAnalysisCard analysis={null} />);

    expect(screen.queryByText(/Kaynağı bilinmiyor/i)).not.toBeInTheDocument();
    expect(screen.getByText(/henüz bir AI analizi oluşturulmamış/i)).toBeInTheDocument();
  });
});
