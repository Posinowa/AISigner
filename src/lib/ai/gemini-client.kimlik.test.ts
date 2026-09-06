// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Vertex AI kimlik çözümü (#522).
 *
 * ⚠️ ÖLÇÜLMÜŞ SORUN: istemci HER KOŞULDA bir anahtar DOSYASI istiyordu.
 * Google Cloud'da (Cloud Run) doğru yöntem bunun tersi — kimlik servisin
 * kendi service account'undan ADC ile gelir ve ortada hiç anahtar dosyası
 * olmaz. Dosya yokken `keyFilename` var olmayan bir yolu gösteriyor, istemci
 * kurulumu patlıyor ve çağıran taraf #335'in graceful degradation'ı gereği
 * MOCK'a düşüyordu: IAM doğru olsa bile AI sessizce sahte içerik üretirdi.
 */

const { genAiMock, existsMock } = vi.hoisted(() => ({
  genAiMock: vi.fn(),
  existsMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: async () => ({ text: "ok" }) };
    constructor(ayar: unknown) {
      genAiMock(ayar);
    }
  },
}));
vi.mock("fs", () => ({ existsSync: existsMock }));

import { getModel, resetClientForTests } from "./gemini-client";

/**
 * ⚠️ İstemci TEMBEL kuruluyor: `getModel()` yalnız bir sarmalayıcı döndürüyor,
 * `GoogleGenAI` ilk `generateContent` çağrısında yaratılıyor. Kimlik ayarını
 * görmek için gerçekten bir üretim çağrısı yapmak gerekiyor.
 */
const uret = () => getModel().generateContent("merhaba");

beforeEach(() => {
  vi.clearAllMocks();
  resetClientForTests();
  process.env.GOOGLE_CLOUD_PROJECT = "test-proje";
  delete process.env.K_SERVICE;
});

describe("kimlik çözümü", () => {
  /*
   * ⚠️ EN KRİTİK İDDİA. `googleAuthOptions` HİÇ verilmemeli — boş bir nesne
   * ya da `keyFilename: undefined` göndermek aynı şey değil; SDK'nın hangi
   * varsayılanları uygulayacağını belirsizleştirirdi.
   */
  it("⚠️ Cloud Run'da dosya yoksa googleAuthOptions HİÇ verilmez — ADC devreye girsin", async () => {
    existsMock.mockReturnValue(false);
    process.env.K_SERVICE = "aisigner";

    await uret();

    const ayar = genAiMock.mock.calls[0][0];
    expect(ayar).not.toHaveProperty("googleAuthOptions");
    expect(ayar.project).toBe("test-proje");
    expect(ayar.vertexai).toBe(true);
  });

  /*
   * ⚠️ CI'DA ÖLÇÜLEREK BULUNDU. İlk sürüm dosya yokken her ortamda ADC'ye
   * düşüyordu; GCP dışında SDK metadata sunucusunu yokluyor ve istek HATA
   * VERMİYOR, ASILIYOR — CI'da öğrenci panosunu yükleyen üç E2E testi 30
   * saniyelik zaman aşımına düştü. #335'in sözleşmesi hatanın HEMEN
   * fırlatılması; yavaş başarısızlık graceful degradation'ı sessiz bir
   * kilitlenmeye çevirir.
   */
  it("⚠️ ne dosya ne Cloud Run varsa HEMEN fırlatır — ADC yoklamasına bırakılmaz", async () => {
    existsMock.mockReturnValue(false);

    await expect(uret()).rejects.toThrow(/kimliği yok/i);
    expect(genAiMock).not.toHaveBeenCalled();
  });

  /*
   * ⚠️ YEREL GELİŞTİRME KIRILMAMALI: dosya varsa davranış aynen sürer.
   */
  it("anahtar dosyası VARSA keyFilename ile kurulur", async () => {
    existsMock.mockReturnValue(true);

    await uret();

    const ayar = genAiMock.mock.calls[0][0];
    expect(ayar.googleAuthOptions.keyFilename).toContain("gcp-credentials.json");
  });

  /*
   * ⚠️ KARAR DOSYANIN VARLIĞINA DAYANIR, env'e ya da platform tespitine
   * DEĞİL: "Cloud Run'da mıyız" sorusunu tahmin etmek yanılabilir, dosyanın
   * yerinde olup olmadığı yanılmaz.
   */
  it("⚠️ karar dosyanın VARLIĞINA bakar — yol tanımlı ama dosya yoksa keyFilename verilmez", async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/olmayan/yol/anahtar.json";
    process.env.K_SERVICE = "aisigner";
    existsMock.mockReturnValue(false);

    await uret();

    expect(genAiMock.mock.calls[0][0]).not.toHaveProperty("googleAuthOptions");
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  it("proje kimliği yoksa FIRLATIR — çağıran taraf mock'a düşer (#335 sözleşmesi)", async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    existsMock.mockReturnValue(true);

    await expect(uret()).rejects.toThrow(/GOOGLE_CLOUD_PROJECT/);
  });
});
