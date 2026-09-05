import { describe, it, expect } from "vitest";
import {
  atamaTekilKey,
  bireyselTekilKey,
  takimTekilKey,
} from "./tekil-anahtar";

/**
 * #503 — Koşullu tekillik anahtarı.
 *
 * ⚠️ BİÇİM MIGRATION'DAKİ BACKFILL İLE AYNI OLMALI. Ayrışırsa migration'dan
 * önce ve sonra yazılan satırlar farklı uzayda tekil olur ve #58'in koruması
 * SESSİZCE delinir — bu testler biçimi kilitliyor.
 */
describe("anahtar biçimi", () => {
  it("bireysel: sp:<profil>:<şablon>", () => {
    expect(bireyselTekilKey("sp-1", "pt-1")).toBe("sp:sp-1:pt-1");
  });

  it("takım: tm:<takım>:<şablon>", () => {
    expect(takimTekilKey("t-1", "pt-1")).toBe("tm:t-1:pt-1");
  });

  it("⚠️ bireysel ve takım anahtarları ÇAKIŞMAZ — önekler farklı", () => {
    // Aynı id'ye sahip bir profil ve takım olsaydı önek olmadan çakışırlardı.
    expect(bireyselTekilKey("x", "pt")).not.toBe(takimTekilKey("x", "pt"));
  });
});

describe("atamaTekilKey", () => {
  it("tekrarlanamaz bireysel atamada anahtar DOLU — #58 koruması sürer", () => {
    expect(
      atamaTekilKey({
        projectTemplateId: "pt-1",
        tekrarlanabilir: false,
        studentProfileId: "sp-1",
      }),
    ).toBe("sp:sp-1:pt-1");
  });

  it("tekrarlanamaz takım atamasında anahtar DOLU", () => {
    expect(
      atamaTekilKey({
        projectTemplateId: "pt-1",
        tekrarlanabilir: false,
        teamId: "t-1",
      }),
    ).toBe("tm:t-1:pt-1");
  });

  it("⚠️ TEKRARLANABİLİR şablonda NULL — kısıt bilerek gevşiyor", () => {
    expect(
      atamaTekilKey({
        projectTemplateId: "pt-1",
        tekrarlanabilir: true,
        studentProfileId: "sp-1",
      }),
    ).toBeNull();
  });

  it("tekrarlanabilir TAKIM atamasında da NULL", () => {
    expect(
      atamaTekilKey({
        projectTemplateId: "pt-1",
        tekrarlanabilir: true,
        teamId: "t-1",
      }),
    ).toBeNull();
  });

  it("⚠️ sahip YOKSA null — #332'nin CHECK kısıtı zaten bunu engelliyor", () => {
    // Buraya düşmek `assigned_project_sahip_tek` ihlali demektir; anahtar
    // uydurmak, olmayan bir sahiplik varsaymak olurdu.
    expect(
      atamaTekilKey({ projectTemplateId: "pt-1", tekrarlanabilir: false }),
    ).toBeNull();
  });

  it("⚠️ bireysel sahiplik takımdan ÖNCE gelir — ikisi birden olamaz (#332)", () => {
    // Savunma amaçlı: veri bozuksa bile deterministik bir anahtar üretilsin.
    expect(
      atamaTekilKey({
        projectTemplateId: "pt-1",
        tekrarlanabilir: false,
        studentProfileId: "sp-1",
        teamId: "t-1",
      }),
    ).toBe("sp:sp-1:pt-1");
  });
});
