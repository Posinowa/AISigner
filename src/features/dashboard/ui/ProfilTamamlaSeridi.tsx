import Link from "next/link";
import { DogrulamaYenidenGonder } from "@/features/auth/ui/DogrulamaYenidenGonder";
import { dogrulandiMi, type DogrulamaDurumu } from "@/features/auth/ui/DogrulanmisRozet";

/**
 * #290: Hesabın yarım kalan idari işleri — TEK yerde, yalnızca gerçekten
 * eksik varken.
 *
 * Önceden bu işler karşılamanın içine dağılmıştı: "Doğrulanmamış" uyarısı
 * kullanıcının adının hemen yanında duruyor, fotoğraf yükleme aracı da
 * panelin ilk kartı oluyordu. İkisi de her zaman görünüyordu — hesabı tamam
 * olan kullanıcı bile her girişte bunlara bakıyordu.
 *
 * Artık şerit hiçbir eksik yokken HİÇ basılmıyor. Görünürlüğü kalıcı değil,
 * duruma bağlı.
 */
export function ProfilTamamlaSeridi({
  emailVerified,
  fotografVar,
  /** Fotoğraf yükleme alanının sayfa içindeki çapası. */
  fotografCapasi = "#profil",
}: {
  emailVerified: DogrulamaDurumu;
  fotografVar: boolean;
  fotografCapasi?: string;
}) {
  const epostaEksik = !dogrulandiMi(emailVerified);
  const fotografEksik = !fotografVar;

  // Eksik yoksa şerit hiç yok. Boş bir "her şey tamam" kartı da göstermiyoruz;
  // tamamlanmış bir işi duyurmak yer kaplamaktan başka bir şey yapmaz.
  if (!epostaEksik && !fotografEksik) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <p className="text-sm font-semibold text-amber-900">Profilini tamamla</p>
      <p className="mt-0.5 text-xs text-amber-800/80">
        Bunlar tamamlanmadan eşleştirme ve bildirimler eksik çalışır.
      </p>

      <ul className="mt-3.5 space-y-2.5">
        {epostaEksik ? (
          <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/70 px-3.5 py-3">
            <span className="text-sm text-slate-700">
              E-posta adresin henüz doğrulanmadı.
            </span>
            <DogrulamaYenidenGonder emailVerified={emailVerified} />
          </li>
        ) : null}

        {fotografEksik ? (
          <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/70 px-3.5 py-3">
            <span className="text-sm text-slate-700">
              Profil fotoğrafın yok — mentörün ve ekip seni tanıyamıyor.
            </span>
            <Link
              href={fotografCapasi}
              className="shrink-0 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Fotoğraf ekle
            </Link>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
