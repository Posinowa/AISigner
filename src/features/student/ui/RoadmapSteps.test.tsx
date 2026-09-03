// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
// Yorum ve dosya bölümleri kendi isteklerini atıyor; burada kapsam dışı.
vi.mock("@/features/messaging/ui/StepComments", () => ({ StepComments: () => null }));
vi.mock("@/features/files/ui/StepFiles", () => ({ StepFiles: () => null }));

import { RoadmapSteps } from "./RoadmapSteps";

/**
 * #416: Kilit ve eyleme açıklık kuralı `roadmap/odak.ts`'e taşındı.
 *
 * ⚠️ BU TESTLER MUTASYON TESTİNDE AÇILAN BİR BOŞLUK İÇİN YAZILDI. Kuralı
 * ortak modüle çıkardıktan sonra `isLocked`'ı sabit `false` yapan bir
 * mutasyon HAYATTA KALDI: bileşenin kilit davranışını doğrulayan hiçbir test
 * yoktu. Kuralın tek kaynaktan geldiğini iddia etmek, iki tarafın da o
 * kaynağa göre davrandığını göstermeyi gerektiriyor.
 */
const adim = (over: Partial<Parameters<typeof RoadmapSteps>[0]["steps"][number]> = {}) => ({
  id: "s1",
  order: 1,
  title: "Adım",
  description: "Açıklama metni",
  status: "TODO",
  estimatedHours: 2,
  resources: [],
  ...over,
});

describe("RoadmapSteps — kilit kuralı ortak modülden", () => {
  it("önceki adım tamamlanmadıysa sonraki KİLİTLİ görünür", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, title: "Birinci", status: "TODO" }),
          adim({ id: "s2", order: 2, title: "İkinci", description: "İkincinin açıklaması" }),
        ]}
        isDraft={false}
      />,
    );

    expect(screen.getByText("Önceki aşamanın tamamlanması bekleniyor")).toBeInTheDocument();
    // Kilitli adımın içeriği gösterilmez.
    expect(screen.queryByText("İkincinin açıklaması")).not.toBeInTheDocument();
  });

  it("önceki adım tamamlandıysa sonraki AÇILIR", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, title: "Birinci", status: "COMPLETED" }),
          adim({ id: "s2", order: 2, title: "İkinci", description: "İkincinin açıklaması" }),
        ]}
        isDraft={false}
      />,
    );

    expect(screen.queryByText("Önceki aşamanın tamamlanması bekleniyor")).not.toBeInTheDocument();
    expect(screen.getByText("İkincinin açıklaması")).toBeInTheDocument();
  });

  it("ilk adım hiçbir zaman kilitli değil", () => {
    render(<RoadmapSteps steps={[adim({ description: "İlk açıklama" })]} isDraft={false} />);

    expect(screen.queryByText("Önceki aşamanın tamamlanması bekleniyor")).not.toBeInTheDocument();
    expect(screen.getByText("İlk açıklama")).toBeInTheDocument();
  });

  it("⚠️ REVİZYONDAKİ adım sıralamaya rağmen kilitli değil (#379)", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, title: "Birinci", status: "IN_PROGRESS" }),
          adim({
            id: "s2",
            order: 2,
            title: "İkinci",
            status: "REVISION_REQUESTED",
            description: "Revizyondaki açıklama",
          }),
        ]}
        isDraft={false}
      />,
    );

    expect(screen.queryByText("Önceki aşamanın tamamlanması bekleniyor")).not.toBeInTheDocument();
    expect(screen.getByText("Revizyondaki açıklama")).toBeInTheDocument();
  });

  it("#416: her adım kendi çapasını taşır — odak kartı buraya bağ veriyor", () => {
    const { container } = render(
      <RoadmapSteps steps={[adim({ id: "abc" })]} isDraft={false} />,
    );
    expect(container.querySelector("#adim-abc")).toBeInTheDocument();
  });
});

describe("RoadmapSteps — eyleme açıklık ortak modülden", () => {
  /*
   * ⚠️ Bu test de mutasyonla açıldı: `isActionable`'ı sabit `true` yapan
   * sürüm hayatta kalıyordu. `isLocked` ile `isActionable` FARKLI kurallar;
   * ikincisi "başla" düğmesini yönetiyor ve tek başına doğrulanmalı.
   */
  it("eyleme açık adımda 'Bu Adıma Başla' düğmesi var", () => {
    render(<RoadmapSteps steps={[adim()]} isDraft={false} />);
    expect(screen.getByRole("button", { name: /Bu Adıma Başla/ })).toBeInTheDocument();
  });

  it("devam eden adımda başlatma değil TAMAMLAMA düğmesi var", () => {
    render(<RoadmapSteps steps={[adim({ status: "IN_PROGRESS" })]} isDraft={false} />);
    expect(screen.queryByRole("button", { name: /Bu Adıma Başla/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adımı Tamamla/ })).toBeInTheDocument();
  });

  it("revizyondaki adımda 'Düzeltmeye Başla' var, doğrudan tamamlama YOK (#379)", () => {
    render(<RoadmapSteps steps={[adim({ status: "REVISION_REQUESTED" })]} isDraft={false} />);
    expect(screen.getByRole("button", { name: /Düzeltmeye Başla/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adımı Tamamla/ })).not.toBeInTheDocument();
  });

  it("⚠️ KİLİTLİ adımda hiçbir eylem düğmesi YOK", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, title: "Birinci", status: "TODO" }),
          adim({ id: "s2", order: 2, title: "İkinci", status: "TODO" }),
        ]}
        isDraft={false}
      />,
    );
    // Yalnız İLK adımın düğmesi olmalı; kilitli ikincininki değil.
    expect(screen.getAllByRole("button", { name: /Bu Adıma Başla/ })).toHaveLength(1);
  });

  it("taslak yol haritasında (#52) hiçbir eylem yok", () => {
    render(<RoadmapSteps steps={[adim()]} isDraft />);
    expect(screen.queryByRole("button", { name: /Bu Adıma Başla/ })).not.toBeInTheDocument();
  });

  it("mezun stajyerde (#208) hiçbir eylem yok", () => {
    render(<RoadmapSteps steps={[adim()]} isDraft={false} isGraduated />);
    expect(screen.queryByRole("button", { name: /Bu Adıma Başla/ })).not.toBeInTheDocument();
  });
});
