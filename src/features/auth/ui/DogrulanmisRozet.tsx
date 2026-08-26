import { BadgeCheck, ShieldAlert } from "lucide-react";

/**
 * #259: Hesabın e-postasının doğrulanıp doğrulanmadığını gösteren ibare.
 *
 * `emailVerified` #247'deki akışla doluyor. Alan bir TARİH: dolu olması
 * doğrulanmış demek, `null` olması doğrulanmamış. Tarihin kendisi
 * gösterilmiyor — kullanıcı için anlamlı olan durumun kendisi.
 *
 * Sunucudan JSON ile geldiğinde tarih string'e dönüşür; bu yüzden her iki
 * biçim de kabul ediliyor.
 */

export type DogrulamaDurumu = Date | string | null | undefined;

export function dogrulandiMi(emailVerified: DogrulamaDurumu): boolean {
  if (!emailVerified) return false;

  // Geçersiz tarih (bozuk string) doğrulanmış SAYILMAZ.
  const tarih = emailVerified instanceof Date ? emailVerified : new Date(emailVerified);
  return !Number.isNaN(tarih.getTime());
}

export function DogrulanmisRozet({
  emailVerified,
  /** Doğrulanmamış durumu da göster. Kapalıyken yalnızca olumlu ibare çıkar. */
  dogrulanmamisiGoster = true,
  boyut = "normal",
}: {
  emailVerified: DogrulamaDurumu;
  dogrulanmamisiGoster?: boolean;
  boyut?: "normal" | "kucuk";
}) {
  const dogrulandi = dogrulandiMi(emailVerified);

  if (!dogrulandi && !dogrulanmamisiGoster) return null;

  const olcu =
    boyut === "kucuk"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";
  const ikonOlcu = boyut === "kucuk" ? "w-3 h-3" : "w-3.5 h-3.5";

  if (dogrulandi) {
    return (
      <span
        title="E-posta adresi doğrulanmış hesap"
        className={`inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 ${olcu}`}
      >
        <BadgeCheck className={ikonOlcu} aria-hidden="true" />
        Doğrulanmış hesap
      </span>
    );
  }

  return (
    <span
      title="E-posta adresi henüz doğrulanmamış"
      className={`inline-flex items-center rounded-full border border-amber-200 bg-amber-50 font-semibold text-amber-700 ${olcu}`}
    >
      <ShieldAlert className={ikonOlcu} aria-hidden="true" />
      Doğrulanmamış
    </span>
  );
}
