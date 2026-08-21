import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/lib/logger";

/**
 * #241: SMTP gönderici.
 *
 * Ayarlar ortam değişkenlerinden okunur; gizli bilgi kaynak koda girmez.
 * Gerekli değişkenler `.env.example` içinde.
 *
 * Tasarım kararı — yapılandırma yoksa ÇÖKMEZ: SMTP değişkenleri tanımlı
 * değilse gönderim atlanır ve durum loglanır. Kod tabanındaki mevcut desenle
 * aynı (GCS yoksa yerel disk, Vertex AI yoksa mock). Böylece lokal geliştirme
 * ve test, posta sunucusu olmadan da çalışır.
 */

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "send-failed" };

/**
 * Ortam değişkenlerini okur. Zorunlu alanlardan biri eksikse `null` döner —
 * çağıran taraf bunu "yapılandırılmamış" durumu olarak ele alır.
 */
export function readMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  // 465 → örtük TLS, 587 → STARTTLS. SMTP_SECURE ile elle geçilebilir.
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;

  return {
    host,
    port,
    secure,
    user,
    pass,
    // Gönderen adresi SMTP hesabıyla aynı olmalı; çoğu sunucu farklıysa reddeder.
    from: process.env.MAIL_FROM ?? user,
  };
}

/**
 * Gönderici modül düzeyinde tutulur: her istekte yeni bağlantı havuzu kurmak
 * yerine tekrar kullanılır.
 */
let cached: Transporter | null = null;

export function getTransporter(config: MailConfig): Transporter {
  if (!cached) {
    cached = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }
  return cached;
}

/** Yalnızca testler için: modül düzeyindeki göndericiyi sıfırlar. */
export function resetTransporterForTests(): void {
  cached = null;
}

/**
 * E-posta gönderir. Hiçbir durumda hata FIRLATMAZ — çağıran akışın (kayıt,
 * şifre sıfırlama) e-posta yüzünden kırılmaması için sonucu döner.
 */
export async function sendMail(mesaj: MailMessage): Promise<SendResult> {
  const config = readMailConfig();

  if (!config) {
    logger.warn("SMTP yapılandırılmamış — e-posta gönderimi atlandı", {
      to: mesaj.to,
      subject: mesaj.subject,
    });
    return { sent: false, reason: "not-configured" };
  }

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      to: mesaj.to,
      subject: mesaj.subject,
      text: mesaj.text,
      ...(mesaj.html ? { html: mesaj.html } : {}),
    });
    logger.info("E-posta gönderildi", { to: mesaj.to, subject: mesaj.subject });
    return { sent: true };
  } catch (error) {
    // Parola ASLA loglanmaz; yalnızca hata mesajı.
    logger.error("E-posta gönderimi başarısız", {
      to: mesaj.to,
      subject: mesaj.subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, reason: "send-failed" };
  }
}
