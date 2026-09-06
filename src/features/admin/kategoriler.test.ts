import { describe, it, expect } from "vitest";
import {
  KULLANICI_KATEGORILERI,
  gecerliKategori,
  kategoriKosulu,
  aramaKosulu,
} from "./kategoriler";

/**
 * Kategoriler artık TEK KAYNAK ve iki ayrı sorgu bunu paylaşıyor: liste
 * (`getAllUsers`) ve sayaçlar (`kullaniciSayilari`). Önceden ikisi de
 * arayüzde elle yazılıydı ve tesadüfen uyuşuyordu — ikisi de AYNI tam
 * listeyi geziyordu. Sayfalamayla o tesadüf bitti.
 */
describe("gecerliKategori", () => {
  it("bilinen kategoriler geçer", () => {
    for (const k of KULLANICI_KATEGORILERI) {
      expect(gecerliKategori(k)).toBe(k);
    }
  });

  it("⚠️ TANINMAYAN değer ALL'a düşer — istemciden geliyor", () => {
    // Kategori adres çubuğundan geliyor; uydurma bir değer sorguyu
    // patlatmak yerine en geniş ve en zararsız görünüme düşmeli.
    expect(gecerliKategori("DROP TABLE")).toBe("ALL");
    expect(gecerliKategori(null)).toBe("ALL");
    expect(gecerliKategori(undefined)).toBe("ALL");
    expect(gecerliKategori(42)).toBe("ALL");
  });
});

describe("kategoriKosulu — arayüzdeki eski filtrenin birebir karşılığı", () => {
  it("ALL hiçbir koşul koymaz", () => {
    expect(kategoriKosulu("ALL")).toEqual({});
  });

  it("stajyer durumları ROLE de bakar", () => {
    // Eski filtre `u.role !== "STUDENT" || u.accountStatus !== "PENDING"`
    // diyordu; yalnız duruma bakan bir koşul PENDING mentörleri de alırdı.
    for (const [kat, durum] of [
      ["PENDING", "PENDING"],
      ["APPROVED", "APPROVED"],
      ["GRADUATED", "GRADUATED"],
      ["REJECTED", "REJECTED"],
    ] as const) {
      expect(kategoriKosulu(kat)).toEqual({ role: "STUDENT", accountStatus: durum });
    }
  });

  it("⚠️ MENTOR, onay BEKLEYEN başvuruyu DIŞLAR (#250)", () => {
    expect(kategoriKosulu("MENTOR")).toEqual({
      role: "MENTOR",
      accountStatus: { not: "PENDING" },
    });
  });

  it("MENTOR_BASVURU tam tersi — yalnız bekleyenler", () => {
    expect(kategoriKosulu("MENTOR_BASVURU")).toEqual({
      role: "MENTOR",
      accountStatus: "PENDING",
    });
  });

  it("DOGRULANMAMIS, `dogrulandiMi`nin SQL karşılığı", () => {
    // `dogrulandiMi` bir Date'in varlığına bakıyor → NULL kontrolü.
    expect(kategoriKosulu("DOGRULANMAMIS")).toEqual({ emailVerified: null });
  });

  it("STUDENT duruma BAKMAZ — takım üye seçicisi için", () => {
    expect(kategoriKosulu("STUDENT")).toEqual({ role: "STUDENT" });
  });

  it("her kategorinin bir karşılığı var — yeni kategori sessizce eklenemez", () => {
    for (const k of KULLANICI_KATEGORILERI) {
      expect(kategoriKosulu(k)).toBeTypeOf("object");
    }
  });
});

describe("aramaKosulu", () => {
  const alanlar = (k: Record<string, unknown>) =>
    (k.AND as { OR: Record<string, unknown>[] }[]).map((x) =>
      x.OR.map((o) => Object.keys(o)[0]),
    );

  it("boş sorgu koşul üretmez", () => {
    expect(aramaKosulu("")).toBeNull();
    expect(aramaKosulu("   ")).toBeNull();
  });

  it("tek kelime e-posta, ad ve soyadda aranır", () => {
    expect(alanlar(aramaKosulu("ayse")!)).toEqual([["email", "name", "lastName"]]);
  });

  it("⚠️ ÇOK KELİMELİ sorgu bölünür — 'Ayşe Yılmaz' çalışmaya devam etmeli", () => {
    /*
     * İstemci sürümü `${name} ${lastName}` BİRLEŞİK metninde arıyordu.
     * Alanları ayrı ayrı arayan naif bir sunucu karşılığı bunu sessizce
     * kırardı: "Ayşe Yılmaz" ne `name`'e ne `lastName`'e uyar.
     */
    const k = aramaKosulu("Ayşe Yılmaz")!;
    expect((k.AND as unknown[]).length).toBe(2);
  });

  it("kelimeler AND'lenir — hepsi eşleşmeli", () => {
    const k = aramaKosulu("ayse yilmaz")!;
    expect(k.AND).toBeDefined();
    expect(k.OR).toBeUndefined();
  });

  it("büyük/küçük harf duyarsız — istemcideki toLowerCase karşılığı", () => {
    const k = aramaKosulu("AYSE")!;
    const ilk = (k.AND as { OR: Record<string, { mode?: string }>[] }[])[0];
    expect(ilk.OR.every((o) => Object.values(o)[0].mode === "insensitive")).toBe(true);
  });

  it("fazladan boşluklar boş kelime üretmez", () => {
    const k = aramaKosulu("  ayse    yilmaz  ")!;
    expect((k.AND as unknown[]).length).toBe(2);
  });
});
