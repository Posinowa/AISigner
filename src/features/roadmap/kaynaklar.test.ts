import { describe, it, expect } from "vitest";
import { kaynakEkle, kaynakKaldir, kaynakGuncelle } from "./kaynaklar";

/**
 * #494 — Kaynak düzenleme TEK KAYNAKTAN.
 *
 * ⚠️ Bu mantık iki kez yazılıydı (adım düzenleme formu + yeni adım formu) ve
 * hiç testi yoktu. İkisi tesadüfen aynı davranıyordu; biri değişse fark
 * hata gibi görünmezdi.
 */
describe("kaynakEkle", () => {
  it("sona boş satır ekler", () => {
    expect(kaynakEkle(["a"])).toEqual(["a", ""]);
  });

  it("boş listeye de ekler", () => {
    expect(kaynakEkle([])).toEqual([""]);
  });

  it("⚠️ girdi dizisini DEĞİŞTİRMEZ — React state yerinde değiştirilemez", () => {
    const asil = ["a"];
    kaynakEkle(asil);
    expect(asil).toEqual(["a"]);
  });
});

describe("kaynakKaldir", () => {
  it("verilen sıradakini kaldırır", () => {
    expect(kaynakKaldir(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("⚠️ SON satır da kaldırılabilir — boş liste meşru", () => {
    // Formlar kaydederken boşları zaten süzüyor; "en az bir satır kalsın"
    // kuralı burada DEĞİL, aksi halde mentör tek kaynağı silemezdi.
    expect(kaynakKaldir(["tek"], 0)).toEqual([]);
  });

  it("sıra dışı indekste liste bozulmaz", () => {
    expect(kaynakKaldir(["a", "b"], 9)).toEqual(["a", "b"]);
    expect(kaynakKaldir(["a", "b"], -1)).toEqual(["a", "b"]);
  });

  it("girdi dizisini değiştirmez", () => {
    const asil = ["a", "b"];
    kaynakKaldir(asil, 0);
    expect(asil).toEqual(["a", "b"]);
  });
});

describe("kaynakGuncelle", () => {
  it("verilen sıradakini değiştirir", () => {
    expect(kaynakGuncelle(["a", "b"], 1, "yeni")).toEqual(["a", "yeni"]);
  });

  it("boş değer de yazılabilir — kullanıcı alanı temizleyebilmeli", () => {
    expect(kaynakGuncelle(["a"], 0, "")).toEqual([""]);
  });

  it("⚠️ değeri KIRPMAZ — yazarken boşluk yutulmamalı", () => {
    // Mutasyon testinde bulundu: `deger.trim()` eklemek testlerden geçiyordu.
    // Kırpsaydı mentör "React Router" yazarken kelimeler arası boşluk anında
    // yutulur, alan bozuk hissettirirdi. Kaydederken boşlar zaten süzülüyor —
    // temizlik ORADA yapılıyor, her tuş vuruşunda değil.
    expect(kaynakGuncelle([""], 0, "React ")).toEqual(["React "]);
    expect(kaynakGuncelle([""], 0, "  ")).toEqual(["  "]);
  });

  it("⚠️ sıra dışı indekste liste AYNEN döner, satır UYDURULMAZ", () => {
    expect(kaynakGuncelle(["a"], 5, "x")).toEqual(["a"]);
    expect(kaynakGuncelle(["a"], -1, "x")).toEqual(["a"]);
  });

  it("girdi dizisini değiştirmez", () => {
    const asil = ["a", "b"];
    kaynakGuncelle(asil, 0, "z");
    expect(asil).toEqual(["a", "b"]);
  });
});

describe("#494 — iki form aynı kuralı paylaşır", () => {
  it("aynı işlem dizisi, hangi formdan gelirse gelsin aynı sonucu verir", () => {
    // Düzenleme formu ve yeni adım formu artık AYNI fonksiyonları çağırıyor;
    // bu test o sözleşmeyi somutlaştırıyor.
    const uygula = (baslangic: string[]) => {
      let k = kaynakEkle(baslangic);
      k = kaynakGuncelle(k, k.length - 1, "https://ornek");
      k = kaynakKaldir(k, 0);
      return k;
    };
    expect(uygula([""])).toEqual(["https://ornek"]);
    expect(uygula(["eski"])).toEqual(["https://ornek"]);
  });
});
