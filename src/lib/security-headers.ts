/**
 * Uygulamanın gönderdiği güvenlik başlıkları.
 *
 * `next.config.ts` içinde gömülü duruyordu; test edilebilmesi için saf
 * fonksiyona çıkarıldı. Politika kodun bir parçası — regresyonu testle korunur.
 */

/**
 * Content-Security-Policy üretir.
 *
 * @param isDev geliştirme ortamı mı — TEK farkı `'unsafe-eval'`.
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  return [
    "default-src 'self'",

    // 'unsafe-eval': YALNIZCA geliştirmede. Next.js'in HMR/react-refresh katmanı
    // eval kullanır; üretim bundle'ı kullanmaz. Üretimde açık bırakmak, bir
    // XSS'in string'den kod üretmesine izin vermek demekti — bedelsiz kaldırıldı.
    //
    // 'unsafe-inline' (script-src): Next.js hydration verisini inline <script>
    // ile gömdüğü için hâlâ gerekli. Kaldırmanın tek yolu nonce'tur; nonce her
    // istekte değiştiği için nonce kullanan sayfalar ZORUNLU olarak dinamik
    // render'a düşer (statik landing + /terms + /privacy + /verify-certificate
    // bundan etkilenir). Bu takas ayrı bir iş olarak değerlendirilmeli.
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",

    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/** Tüm rotalara uygulanan güvenlik başlıkları. */
export function buildSecurityHeaders(isDev: boolean): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // 0 = tarayıcının eski XSS auditor'ını KAPAT. Modern tarayıcılarda bu
    // filtre kendisi bir zafiyet kaynağıydı; CSP onun yerini alıyor.
    { key: "X-XSS-Protection", value: "0" },
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(isDev) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}
