import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * #241 — SMTP gönderim sözleşmesi.
 *
 * En kritik davranış: yapılandırma yoksa uygulama ÇÖKMEZ. Kayıt ve şifre
 * sıfırlama akışları e-posta yüzünden kırılmamalı.
 */

const { sendMailMock, createTransportMock, loggerMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  return {
    sendMailMock,
    createTransportMock: vi.fn(() => ({ sendMail: sendMailMock })),
    loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import {
  readMailConfig,
  sendMail,
  resetTransporterForTests,
} from "./mail";

const ORJINAL = { ...process.env };

function smtpAyarla(ek: Record<string, string> = {}) {
  process.env.SMTP_HOST = "smtp.ornek.com";
  process.env.SMTP_USER = "bot@posinowa.com";
  process.env.SMTP_PASS = "gizli";
  Object.assign(process.env, ek);
}

beforeEach(() => {
  for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_PORT", "SMTP_SECURE", "MAIL_FROM"]) {
    delete process.env[k];
  }
  vi.clearAllMocks();
  resetTransporterForTests();
  sendMailMock.mockResolvedValue({ messageId: "1" });
});

afterEach(() => {
  process.env = { ...ORJINAL };
});

const mesaj = { to: "stajyer@ornek.com", subject: "Test", text: "merhaba" };

describe("readMailConfig — yapılandırma okuma", () => {
  it("zorunlu değişkenler eksikse null döner", () => {
    expect(readMailConfig()).toBeNull();
  });

  it("host var ama parola yoksa null döner", () => {
    process.env.SMTP_HOST = "smtp.ornek.com";
    process.env.SMTP_USER = "bot@posinowa.com";
    expect(readMailConfig()).toBeNull();
  });

  it("port belirtilmezse 587 (STARTTLS) varsayılır", () => {
    smtpAyarla();
    expect(readMailConfig()).toMatchObject({ port: 587, secure: false });
  });

  it("port 465 ise örtük TLS açılır", () => {
    smtpAyarla({ SMTP_PORT: "465" });
    expect(readMailConfig()?.secure).toBe(true);
  });

  it("SMTP_SECURE elle geçilebilir", () => {
    smtpAyarla({ SMTP_PORT: "587", SMTP_SECURE: "true" });
    expect(readMailConfig()?.secure).toBe(true);
  });

  it("MAIL_FROM yoksa gönderen SMTP kullanıcısı olur", () => {
    smtpAyarla();
    expect(readMailConfig()?.from).toBe("bot@posinowa.com");
  });
});

describe("sendMail — yapılandırma yokken", () => {
  it("hata FIRLATMAZ, sonucu döner", async () => {
    await expect(sendMail(mesaj)).resolves.toEqual({
      sent: false,
      reason: "not-configured",
    });
  });

  it("gönderici hiç kurulmaz", async () => {
    await sendMail(mesaj);
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("durum uyarı olarak loglanır", async () => {
    await sendMail(mesaj);
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});

describe("sendMail — yapılandırma varken", () => {
  beforeEach(() => smtpAyarla());

  it("e-postayı gönderir", async () => {
    await expect(sendMail(mesaj)).resolves.toEqual({ sent: true });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: mesaj.to, subject: mesaj.subject }),
    );
  });

  it("gönderici tek sefer kurulur (bağlantı havuzu tekrar kullanılır)", async () => {
    await sendMail(mesaj);
    await sendMail(mesaj);
    await sendMail(mesaj);
    expect(createTransportMock).toHaveBeenCalledTimes(1);
  });

  it("SMTP hatasında ÇÖKMEZ, sonucu döner", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("bağlantı reddedildi"));
    await expect(sendMail(mesaj)).resolves.toEqual({
      sent: false,
      reason: "send-failed",
    });
  });

  it("parola loglanmaz", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("auth failed"));
    await sendMail(mesaj);

    const tumLoglar = JSON.stringify([
      loggerMock.info.mock.calls,
      loggerMock.warn.mock.calls,
      loggerMock.error.mock.calls,
    ]);
    expect(tumLoglar).not.toContain("gizli");
  });
});
