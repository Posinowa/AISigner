// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

describe("RoadmapSteps — tamamlanan adımların katlanması (#417)", () => {
  it("tamamlanan adım tek satıra iner, içeriği gizlenir", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, title: "Birinci", status: "COMPLETED", description: "Bitmiş iş" }),
          adim({ id: "s2", order: 2, title: "İkinci" }),
        ]}
        isDraft={false}
      />,
    );

    expect(screen.getByText("1 adım tamamlandı")).toBeInTheDocument();
    expect(screen.queryByText("Bitmiş iş")).not.toBeInTheDocument();
    // Aktif adım açık kalır.
    expect(screen.getByText("İkinci")).toBeInTheDocument();
  });

  it("ardışık tamamlananlar tek satırda sayılır", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, status: "COMPLETED" }),
          adim({ id: "s2", order: 2, status: "COMPLETED" }),
          adim({ id: "s3", order: 3, status: "COMPLETED" }),
          adim({ id: "s4", order: 4, title: "Aktif" }),
        ]}
        isDraft={false}
      />,
    );
    expect(screen.getByText("3 adım tamamlandı")).toBeInTheDocument();
  });

  it("'Detayları göster' katlanmış adımları açar", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, status: "COMPLETED", description: "Bitmiş iş" }),
          adim({ id: "s2", order: 2, title: "İkinci" }),
        ]}
        isDraft={false}
      />,
    );

    expect(screen.queryByText("Bitmiş iş")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /adım tamamlandı/ }));
    expect(screen.getByText("Bitmiş iş")).toBeInTheDocument();
  });

  /*
   * ⚠️ Mezunun portfolyosu salt okunur ama GÖRÜNÜR olmalı (#208). Tüm
   * adımları tamamlanmış olduğu için körlemesine katlamak, sertifikanın
   * dayanağı olan işi gizlerdi.
   */
  it("⚠️ MEZUN stajyerde tamamlananlar VARSAYILAN AÇIK (#208)", () => {
    render(
      <RoadmapSteps
        steps={[adim({ id: "s1", order: 1, status: "COMPLETED", description: "Bitmiş iş" })]}
        isDraft={false}
        isGraduated
      />,
    );
    expect(screen.getByText("Bitmiş iş")).toBeInTheDocument();
  });

  it("mezun da katlayabilir — varsayılan açık ama kilitli değil", () => {
    render(
      <RoadmapSteps
        steps={[adim({ id: "s1", order: 1, status: "COMPLETED", description: "Bitmiş iş" })]}
        isDraft={false}
        isGraduated
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /adım tamamlandı/ }));
    expect(screen.queryByText("Bitmiş iş")).not.toBeInTheDocument();
  });

  it("⚠️ REVİZYON istenen adım katlanmaz — tam da görülmesi gereken şey (#379)", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, status: "COMPLETED" }),
          adim({
            id: "s2",
            order: 2,
            status: "REVISION_REQUESTED",
            description: "Revizyondaki açıklama",
          }),
        ]}
        isDraft={false}
      />,
    );
    expect(screen.getByText("Revizyondaki açıklama")).toBeInTheDocument();
  });

  it("hiç tamamlanmamışsa katlama satırı YOK", () => {
    render(<RoadmapSteps steps={[adim({ status: "IN_PROGRESS" })]} isDraft={false} />);
    expect(screen.queryByText(/adım tamamlandı/)).not.toBeInTheDocument();
  });

  it("⚠️ katlanmış grup açıldığında kilit kuralı ORİJİNAL sıraya göre çalışır", () => {
    // 1. tamamlanmış, 2. açık, 3. kilitli olmalı — gruplama indeksleri
    // kaydırırsa 3. adım yanlışlıkla açık görünürdü.
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, status: "COMPLETED" }),
          adim({ id: "s2", order: 2, title: "İkinci", description: "İkinci açıklama" }),
          adim({ id: "s3", order: 3, title: "Üçüncü", description: "Üçüncü açıklama" }),
        ]}
        isDraft={false}
      />,
    );
    expect(screen.getByText("İkinci açıklama")).toBeInTheDocument();
    expect(screen.queryByText("Üçüncü açıklama")).not.toBeInTheDocument();
    expect(screen.getByText("Önceki aşamanın tamamlanması bekleniyor")).toBeInTheDocument();
  });
});

describe("RoadmapSteps — yorum sayısı (#407)", () => {
  /*
   * Mentör bir adıma yorum bıraktığında stajyer, o adımın akordeonunu
   * AÇMADIKÇA yorumun varlığını fark edemiyordu; `StepComments` yalnız
   * akordeon gövdesinde render ediliyor.
   */
  it("yorum varsa sayı başlıkta görünür", () => {
    render(<RoadmapSteps steps={[adim({ yorumSayisi: 3 })]} isDraft={false} />);
    expect(screen.getByTitle("3 yorum")).toBeInTheDocument();
    expect(screen.getByTitle("3 yorum")).toHaveTextContent("3");
  });

  it("⚠️ SIFIR yorumda hiç basılmaz — '0 yorum' yer kaplamaktan başka bir şey yapmaz", () => {
    render(<RoadmapSteps steps={[adim({ yorumSayisi: 0 })]} isDraft={false} />);
    expect(screen.queryByTitle(/yorum/)).not.toBeInTheDocument();
  });

  it("alan hiç verilmezse de basılmaz", () => {
    render(<RoadmapSteps steps={[adim()]} isDraft={false} />);
    expect(screen.queryByTitle(/yorum/)).not.toBeInTheDocument();
  });

  /*
   * ⚠️ "YENİ" DEĞİL, TOPLAM. `StepComment`'ta okunma izi yok; "1 yeni yorum"
   * demek yeni bir şema ister ve okunma izi olmadan "yeni" demek uydurma
   * olurdu.
   */
  it("⚠️ metin 'yeni' iddiası taşımaz — yalnız sayı", () => {
    render(<RoadmapSteps steps={[adim({ yorumSayisi: 2 })]} isDraft={false} />);
    expect(screen.getByTitle("2 yorum")).not.toHaveTextContent(/yeni/i);
  });

  it("kilitli adımda da sayı görünür — konuşma olduğunu bilmek yeterli", () => {
    render(
      <RoadmapSteps
        steps={[
          adim({ id: "s1", order: 1, status: "TODO" }),
          adim({ id: "s2", order: 2, yorumSayisi: 1 }),
        ]}
        isDraft={false}
      />,
    );
    expect(screen.getByTitle("1 yorum")).toBeInTheDocument();
  });
});
