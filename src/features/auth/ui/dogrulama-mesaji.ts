/**
 * #247: `/api/auth/verify-email` rotasının `?dogrulama=` parametresini
 * kullanıcıya gösterilecek mesaja çevirir.
 *
 * Saf fonksiyon — bileşenden ayrı tutuldu ki her durum tek tek test
 * edilebilsin. Rota beş durum üretir; hiçbiri sessizce yutulmamalı:
 * bağlantıya tıklayan kullanıcı ne olduğunu MUTLAKA görmeli.
 */

export type DogrulamaMesaji = {
  variant: "success" | "error";
  title: string;
  body: string;
};

const MESAJLAR: Record<string, DogrulamaMesaji> = {
  tamam: {
    variant: "success",
    title: "E-posta adresiniz doğrulandı!",
    body: "Artık e-posta ve şifrenizle giriş yapabilirsiniz.",
  },
  "zaten-dogrulanmis": {
    variant: "success",
    title: "Hesabınız zaten doğrulanmış",
    body: "Doğrudan giriş yapabilirsiniz.",
  },
  "suresi-gecti": {
    variant: "error",
    title: "Doğrulama bağlantısının süresi doldu",
    body: "Bağlantılar 24 saat geçerlidir. Giriş yaptıktan sonra yeni bir doğrulama e-postası isteyebilirsiniz.",
  },
  gecersiz: {
    variant: "error",
    title: "Doğrulama bağlantısı geçersiz",
    body: "Bağlantı eksik veya hatalı olabilir. E-postadaki adresin tamamını kopyaladığınızdan emin olun.",
  },
  hata: {
    variant: "error",
    title: "Doğrulama şu anda yapılamadı",
    body: "Geçici bir sorun oluştu. Lütfen birkaç dakika sonra tekrar deneyin.",
  },
};

/** Bilinmeyen/eksik değer için `null` döner — uydurma mesaj gösterilmez. */
export function dogrulamaMesaji(durum: string | null): DogrulamaMesaji | null {
  if (!durum) return null;
  return MESAJLAR[durum] ?? null;
}
