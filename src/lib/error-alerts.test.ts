import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { sendMailMock, loggerErrorMock, sentryMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  sentryMock: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/mail", () => ({ sendMail: (...a: unknown[]) => sendMailMock(...a) }));
vi.mock("@/lib/sentry", () => ({ sentryBildir: sentryMock }));
vi.mock("@/lib/logger", () => ({
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { bildirSunucuHatasi, resetAlertStateForTests } from "./error-alerts";

const ONCEKI = process.env.ERROR_ALERT_EMAIL;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  resetAlertStateForTests();
  process.env.ERROR_ALERT_EMAIL = "operator@example.com";
  sendMailMock.mockResolvedValue({ sent: true });
});

afterEach(() => {
  vi.useRealTimers();
  if (ONCEKI === undefined) delete process.env.ERROR_ALERT_EMAIL;
  else process.env.ERROR_ALERT_EMAIL = ONCEKI;
});

const baglam = { path: "/api/x", method: "POST", routePath: "/api/x" };

describe("bildirSunucuHatasi — temel davranış", () => {
  it("hata olduğunda operatöre e-posta gönderir", async () => {
    await bildirSunucuHatasi(new Error("patladı"), baglam);

    expect(sendMailMock).toHaveBeenCalledOnce();
    const mesaj = sendMailMock.mock.calls[0]![0];
    expect(mesaj.to).toBe("operator@example.com");
    expect(mesaj.subject).toContain("/api/x");
    expect(mesaj.text).toContain("patladı");
  });

  it("ERROR_ALERT_EMAIL yoksa özellik KAPALI (uygulama etkilenmez)", async () => {
    delete process.env.ERROR_ALERT_EMAIL;

    await bildirSunucuHatasi(new Error("patladı"), baglam);

    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("gövde sürüm ve rota bilgisi taşır (teşhis için)", async () => {
    await bildirSunucuHatasi(new Error("patladı"), baglam);

    const metin = sendMailMock.mock.calls[0]![0].text;
    expect(metin).toContain("Sürüm");
    expect(metin).toContain("POST /api/x");
  });
});

describe("susturma — e-posta seli önlenir", () => {
  // SMTP hesapları hızla kısıtlanır; bir uç sürekli 500 verirse susturma
  // olmadan dakikada yüzlerce mail giderdi.
  it("aynı hata tekrarlanınca YALNIZCA bir kez gönderilir", async () => {
    for (let i = 0; i < 20; i++) {
      await bildirSunucuHatasi(new Error("aynı hata"), baglam);
    }

    expect(sendMailMock).toHaveBeenCalledOnce();
  });

  it("FARKLI hatalar ayrı ayrı bildirilir (susturma hepsini kapatmaz)", async () => {
    await bildirSunucuHatasi(new Error("birinci"), baglam);
    await bildirSunucuHatasi(new Error("ikinci"), baglam);

    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("aynı hata FARKLI rotalarda ayrı bildirilir", async () => {
    await bildirSunucuHatasi(new Error("aynı"), { ...baglam, routePath: "/api/a" });
    await bildirSunucuHatasi(new Error("aynı"), { ...baglam, routePath: "/api/b" });

    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("susturma penceresi dolunca yeniden gönderilir ve BASTIRILAN SAYI raporlanır", async () => {
    vi.useFakeTimers();

    await bildirSunucuHatasi(new Error("tekrar eden"), baglam);
    for (let i = 0; i < 7; i++) {
      await bildirSunucuHatasi(new Error("tekrar eden"), baglam);
    }
    expect(sendMailMock).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(16 * 60 * 1000);
    await bildirSunucuHatasi(new Error("tekrar eden"), baglam);

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    // Bastırılan tekrarlar kaybolmamalı — operatör hacmi görebilmeli.
    expect(sendMailMock.mock.calls[1]![0].text).toContain("7 kez daha");
  });
});

describe("dayanıklılık", () => {
  it("gönderim başarısız olursa LOGLANIR (sessizce kaybolmaz)", async () => {
    // sendMail sözleşme gereği fırlatmaz, { sent:false } döner.
    sendMailMock.mockResolvedValue({ sent: false, reason: "not-configured" });

    await bildirSunucuHatasi(new Error("patladı"), baglam);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Hata bildirimi gönderilemedi",
      expect.objectContaining({ reason: "not-configured" }),
    );
  });

  it("sendMail beklenmedik şekilde FIRLATIRSA hata dışarı sızmaz", async () => {
    // Kritik: bu fonksiyon hata yolundan çağrılıyor; patlarsa asıl hatayı gölgeler.
    sendMailMock.mockRejectedValue(new Error("smtp çöktü"));

    await expect(bildirSunucuHatasi(new Error("patladı"), baglam)).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalled();
  });

  it("Error olmayan bir değer atılsa da çalışır", async () => {
    await expect(bildirSunucuHatasi("düz metin hata", baglam)).resolves.toBeUndefined();
    expect(sendMailMock).toHaveBeenCalledOnce();
  });

  it("imza haritası sınırsız büyümez", async () => {
    // Mesajında değişken taşıyan hatalar (ör. id) imzayı çeşitlendirir;
    // sınır olmazsa bellek sızıntısına dönerdi.
    for (let i = 0; i < 500; i++) {
      await bildirSunucuHatasi(new Error(`benzersiz ${i}`), baglam);
    }

    // Sınır 200; hepsi tutulsaydı 500 girdi olurdu. Gönderim sayısı bunu
    // doğrudan ölçemez, bu yüzden eski girdilerin düştüğünü tekrar ederek
    // sınıyoruz: ilk hata artık haritada olmamalı → yeniden gönderilmeli.
    sendMailMock.mockClear();
    await bildirSunucuHatasi(new Error("benzersiz 0"), baglam);
    expect(sendMailMock).toHaveBeenCalledOnce();
  });
});

/**
 * #519 — SIRA: Sentry, e-posta kapılarının ÖNÜNDE.
 *
 * ⚠️ Aşağıdaki iki kapı e-postaya AİT: `ERROR_ALERT_EMAIL` yoksa erken
 * dönülüyor ve aynı imzalı hata 15 dakika susturuluyor. Sentry çağrısı
 * arkalarına konsaydı teşhis aracı SMTP yapılandırmasına ve e-posta selini
 * önleyen bir susturmaya mahkûm olurdu — oysa Sentry'nin bütün değeri
 * TEKRARLARI görmek ve e-posta hiç kurulmamışken de çalışmak.
 */
describe("Sentry bildirimi (#519)", () => {
  it("⚠️ ERROR_ALERT_EMAIL tanımsızken BİLE Sentry'ye gider", async () => {
    delete process.env.ERROR_ALERT_EMAIL;

    await bildirSunucuHatasi(new Error("patladı"), baglam);

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(sentryMock).toHaveBeenCalledTimes(1);
  });

  it("⚠️ 15 dakikalık SUSTURMA Sentry'yi kapsamaz — tekrarların hepsi gider", async () => {
    await bildirSunucuHatasi(new Error("patladı"), baglam);
    await bildirSunucuHatasi(new Error("patladı"), baglam);
    await bildirSunucuHatasi(new Error("patladı"), baglam);

    // E-posta susturuldu…
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    // …ama teşhis aracı her tekrarı gördü.
    expect(sentryMock).toHaveBeenCalledTimes(3);
  });

  it("teşhis için gereken bağlam etiket olarak taşınır", async () => {
    await bildirSunucuHatasi(new Error("patladı"), { ...baglam, istekKimligi: "abc123" });

    expect(sentryMock.mock.calls[0][1]).toMatchObject({
      routePath: "/api/x",
      method: "POST",
      istekKimligi: "abc123",
    });
  });

  it("istek kimliği yoksa etiket HİÇ konmaz — boş değer gürültü olurdu", async () => {
    await bildirSunucuHatasi(new Error("patladı"), baglam);

    expect(sentryMock.mock.calls[0][1]).not.toHaveProperty("istekKimligi");
  });
});
