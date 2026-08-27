// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

// Server action zinciri (prisma/next-auth) jsdom'da yüklenmesin diye mock'lanır.
vi.mock("@/features/student/server/onboarding", () => ({
  saveOnboarding: vi.fn(),
}));

import OnboardingForm from "./OnboardingForm";

describe("OnboardingForm — anket adımı render doğrulaması (#123 / #89-2)", () => {
  it("surveyLoadFailed=true iken 'Ek Sorular' adımı gösterilir (uyarıya erişilebilir)", () => {
    render(<OnboardingForm surveyQuestions={[]} surveyLoadFailed />);
    expect(screen.getByText("Ek Sorular")).toBeInTheDocument();
  });

  it("soru yok + yükleme başarılı (gerçek boş) iken 'Ek Sorular' adımı görünmez", () => {
    render(<OnboardingForm surveyQuestions={[]} surveyLoadFailed={false} />);
    expect(screen.queryByText("Ek Sorular")).not.toBeInTheDocument();
  });

  it("admin sorusu varsa 'Ek Sorular' adımı gösterilir", () => {
    render(
      <OnboardingForm
        surveyQuestions={[{ id: "q1", question: "Hangi alanda gelişmek istersiniz?", options: [] }]}
        surveyLoadFailed={false}
      />,
    );
    expect(screen.getByText("Ek Sorular")).toBeInTheDocument();
  });
});

describe("OnboardingForm — genişletilen başvuru soruları (#289)", () => {
  it("Eğitim adımı eklendi — 4 adım 5'e çıktı", () => {
    render(<OnboardingForm surveyQuestions={[]} surveyLoadFailed={false} />);

    for (const baslik of [
      "Kişisel Bilgiler",
      "Eğitim",
      "Altyapı & Deneyim",
      "Vizyon & Hedefler",
      "Çalışma Tarzı",
    ]) {
      expect(screen.getAllByText(baslik).length).toBeGreaterThan(0);
    }
  });

  it("ilk adımda İL sorulur", () => {
    // Açılış sayfası "81 ilde eşleşme" diyor; il sorulmadan ölçülemiyordu.
    render(<OnboardingForm surveyQuestions={[]} surveyLoadFailed={false} />);

    expect(screen.getByLabelText("Yaşadığın il")).toBeInTheDocument();
  });
});
