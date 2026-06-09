/**
 * Minimal, seviyeli ve ortam-farkında logger.
 *
 * Amaç: dağınık `console.*` çağrılarını tutarlı, zaman damgalı ve seviyeli bir
 * arayüzde toplamak. `debug` seviyesi üretimde susturulur.
 *
 * Gelecekte bir gözlemlenebilirlik sağlayıcısına (Datadog, Sentry, Pino vb.)
 * geçişte yalnızca buradaki `emit` fonksiyonu değiştirilir; çağrı yerleri aynı kalır.
 */

type Level = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";

function emit(level: Level, message: string, meta?: unknown): void {
  // Üretimde gürültüyü azalt: debug loglarını atla
  if (level === "debug" && isProd) return;

  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  const sink =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (meta !== undefined) sink(line, meta);
  else sink(line);
}

export const logger = {
  debug: (message: string, meta?: unknown) => emit("debug", message, meta),
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta),
};
