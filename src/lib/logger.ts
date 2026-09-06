/**
 * Minimal, seviyeli ve ortam-farkında logger.
 *
 * Amaç: dağınık `console.*` çağrılarını tutarlı, zaman damgalı ve seviyeli bir
 * arayüzde toplamak. `debug` seviyesi üretimde susturulur.
 *
 * ÜRETİMDE JSON, GELİŞTİRMEDE OKUNAKLI METİN:
 * Öncesi her ortamda `[zaman] [SEVIYE] mesaj` düz metni basıyordu ve `meta`
 * ikinci argüman olarak gidiyordu. Bir log toplayıcı (Cloud Logging, Datadog,
 * Loki) bunu tek bir opak string olarak görür — seviyeye göre filtreleyemez,
 * alan üzerinden arayamaz, uyarı kuralı kuramazsınız. Üretimde satır başına tek
 * JSON nesnesi basmak bunların hepsini bedelsiz açar; geliştirmede ise JSON
 * terminalde okumayı zorlaştırdığı için eski biçim korunur.
 *
 * Bir gözlemlenebilirlik sağlayıcısına (Sentry vb.) geçişte yalnızca buradaki
 * `emit` değiştirilir; çağrı yerleri aynı kalır.
 */

type Level = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";

function emit(level: Level, message: string, meta?: unknown): void {
  // Üretimde gürültüyü azalt: debug loglarını atla
  if (level === "debug" && isProd) return;

  const sink =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (isProd) {
    // Tek satır = tek olay. Toplayıcılar çok satırlı kayıtları böler, bu yüzden
    // JSON.stringify (girintisiz) bilinçli tercih.
    sink(
      JSON.stringify({
        level,
        message,
        time: new Date().toISOString(),
        ...(meta !== undefined ? { meta } : {}),
      }),
    );
    return;
  }

  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (meta !== undefined) sink(line, meta);
  else sink(line);
}

export const logger = {
  debug: (message: string, meta?: unknown) => emit("debug", message, meta),
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta),
};
