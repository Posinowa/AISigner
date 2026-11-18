import { describe, it, expect } from "vitest";
import { SERTIFIKA_PROJE_BASLIGI, projeIlerlemesi, zorlukEtiketi } from "./proje-ozeti";

/**
 * Sertifikadaki proje satırı — herkese açık bir BELGENİN metni.
 *
 * ⚠️ Fazla beyan işverene yanlış bilgi: yarım proje "tamamlandı" diye
 * okunmamalı, takım katkısı projenin oranı gibi görünmemeli.
 */
describe("projeIlerlemesi", () => {
  it("yarım bireysel projede oranı yazar, 'tamamlandı' DEMEZ", () => {
    const metin = projeIlerlemesi({ completedStepsCount: 1, totalStepsCount: 3, takimAdi: null });

    expect(metin).toBe("1/3 adım");
  });

  it("bitmiş bireysel projede 'tamamlandı' der", () => {
    expect(
      projeIlerlemesi({ completedStepsCount: 3, totalStepsCount: 3, takimAdi: null }),
    ).toBe("3/3 adım tamamlandı");
  });

  it("⚠️ takımda ORAN YAZMAZ — katkı ile takımın kapsamı farklı şeyleri sayıyor", () => {
    const metin = projeIlerlemesi({ completedStepsCount: 2, totalStepsCount: 10, takimAdi: "Takım A" });

    expect(metin).toBe("Takım A · 2 adım katkı");
    expect(metin).not.toContain("/10");
  });
});

describe("zorlukEtiketi", () => {
  it("kodu Türkçe etikete çevirir", () => {
    expect(zorlukEtiketi("EASY")).toBe("Kolay");
    expect(zorlukEtiketi("MEDIUM")).toBe("Orta");
    expect(zorlukEtiketi("HARD")).toBe("Zor");
  });

  it("bilinmeyen kodu olduğu gibi bırakır", () => {
    expect(zorlukEtiketi("EXPERT")).toBe("EXPERT");
  });
});

describe("başlık", () => {
  it("⚠️ 'tamamlanan' DEMEZ — liste yarım projeleri de içeriyor", () => {
    expect(SERTIFIKA_PROJE_BASLIGI.toLocaleLowerCase("tr")).not.toContain("tamamlanan");
  });
});
