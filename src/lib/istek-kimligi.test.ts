import { describe, it, expect } from "vitest";
import {
  ISTEK_KIMLIGI_BASLIGI,
  istekKimligiCoz,
  kimlikNormalize,
  yeniKimlik,
} from "./istek-kimligi";

/**
 * İstek kimliği (#491).
 *
 * ⚠️ NEDEN VAR: #467 ile 46 rota yapısal loglamaya geçti ama bir isteğin
 * ürettiği satırlar birbirine bağlı değildi. Eş zamanlı isteklerin logları
 * iç içe geçiyor ve "şu kullanıcı şu saatte hata aldı" denildiğinde o
 * isteğe ait satırlar ayırt edilemiyordu.
 */
describe("kimlikNormalize", () => {
  it("geçerli kimlik korunur — vekilin kimliğiyle aynı kalmalı", () => {
    // Korunmasaydı aynı istek vekilin logunda başka, bizde başka kimlikle
    // görünür ve correlation'ın amacı kaybolurdu.
    const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(kimlikNormalize(uuid)).toBe(uuid);
  });

  it("baştaki/sondaki boşluk kırpılır", () => {
    expect(kimlikNormalize("  abc12345  ")).toBe("abc12345");
  });

  it("⚠️ LOG ENJEKSİYONU denemeleri REDDEDİLİR", () => {
    /*
     * Başlık istemci tarafından uydurulabiliyor ve doğrudan log satırına
     * yazılıyor. Serbest metin kabul etmek, satır sonu ya da ayraç taklidi
     * ile sahte log satırı ürettirmeye kapı açardı.
     */
    for (const kotu of [
      "abc\ndef12345",
      "abc\r\nINFO sahte satır",
      "abc def12345",
      '{"sahte":"json"}',
      "<<<KULLANICI_VERISI>>>",
      "abc;rm -rf /",
    ]) {
      expect(kimlikNormalize(kotu), kotu).toBeNull();
    }
  });

  it("⚠️ ÇOK UZUN kimlik reddedilir — log şişmesin", () => {
    expect(kimlikNormalize("a".repeat(129))).toBeNull();
    expect(kimlikNormalize("a".repeat(128))).toBe("a".repeat(128));
  });

  it("çok kısa kimlik reddedilir — kazara gelen çöp değer geçmesin", () => {
    expect(kimlikNormalize("abc")).toBeNull();
  });

  it("boş/eksik değerler null", () => {
    expect(kimlikNormalize(null)).toBeNull();
    expect(kimlikNormalize(undefined)).toBeNull();
    expect(kimlikNormalize("")).toBeNull();
    expect(kimlikNormalize("   ")).toBeNull();
  });
});

describe("yeniKimlik", () => {
  it("benzersiz üretir", () => {
    const kume = new Set(Array.from({ length: 200 }, () => yeniKimlik()));
    expect(kume.size).toBe(200);
  });

  it("ürettiği kimlik KENDİ doğrulamasından geçer", () => {
    // Geçmeseydi, ürettiğimiz kimlik bir sonraki adımda reddedilirdi.
    expect(kimlikNormalize(yeniKimlik())).not.toBeNull();
  });
});

describe("istekKimligiCoz", () => {
  it("geçerli gelen başlığı kullanır", () => {
    const gelen = "trace-abc-123456";
    expect(istekKimligiCoz(gelen)).toBe(gelen);
  });

  it("⚠️ GEÇERSİZ gelen başlıkta YENİSİNİ üretir — asla boş dönmez", () => {
    // Kimliksiz bir istek, correlation'ın sessizce çalışmadığı bir delik
    // olurdu; her istek mutlaka bir kimlik taşımalı.
    const sonuc = istekKimligiCoz("kotu deger\n");
    expect(sonuc).not.toBe("kotu deger\n");
    expect(kimlikNormalize(sonuc)).not.toBeNull();
  });

  it("başlık yoksa üretir", () => {
    expect(kimlikNormalize(istekKimligiCoz(null))).not.toBeNull();
  });
});

describe("başlık adı", () => {
  it("yaygın ad kullanılıyor — vekiller ve toplayıcılar bunu biliyor", () => {
    expect(ISTEK_KIMLIGI_BASLIGI).toBe("x-request-id");
  });
});
