import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/features/profile/ui/Avatar";

/**
 * #290: Panele girildiğinde görülen ilk alan — stajyer ve mentör için ORTAK.
 *
 * Önceden iki panel farklı diller konuşuyordu: stajyer "Hoş geldin, X" ile
 * karşılanırken mentör düz "Mentor Paneli" başlığı görüyordu. Stajyer
 * tarafında ise karşılamanın hemen altındaki ilk kart, dosya biçimi ve
 * boyut ibaresi taşıyan bir fotoğraf yükleme aracıydı; yani kullanıcıyı
 * karşılayan ilk şey idari bir işti.
 *
 * Bu bileşen karşılamanın üç soruya cevap vermesini zorunlu kılıyor:
 * kimsin (ad + fotoğraf), nerede duruyorsun (`durum`), sırada ne var
 * (`siradaki`). Üçüncüsü tipte opsiyonel ama kasıtlı olarak AYRI bir alan:
 * çağıran taraf "sıradaki eylem yok" demeyi bilerek seçmek zorunda.
 */

export type SiradakiEylem = {
  /** Butonun üzerindeki eylem. */
  etiket: string;
  /** Neden bu eylem — tek cümle. */
  aciklama: string;
  href: string;
};

export function PanelKarsilama({
  ad,
  basHarfler,
  userId,
  fotografVar,
  durum,
  siradaki,
  rozet,
  sag,
}: {
  ad: string;
  basHarfler: string;
  userId: string;
  fotografVar: boolean;
  /** Kullanıcının şu an nerede durduğu — tek cümle. */
  durum: string;
  /** Sıradaki eylem. `null` = gerçekten sıradaki bir şey yok. */
  siradaki: SiradakiEylem | null;
  /** Mezuniyet gibi durum ibareleri. Doğrulama uyarısı buraya GELMEZ. */
  rozet?: React.ReactNode;
  /** Role özel kısayol (ör. mentörde "Proje Şablonları"). */
  sag?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar
            userId={userId}
            basHarfler={basHarfler}
            fotografVar={fotografVar}
            ad={ad}
            boyutSinifi="w-14 h-14"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Hoş geldin, {ad}
              </h1>
              {rozet}
            </div>
            <p className="mt-1 text-sm text-slate-500">{durum}</p>
          </div>
        </div>

        {sag ? <div className="shrink-0">{sag}</div> : null}
      </div>

      {siradaki ? (
        <Link
          href={siradaki.href}
          className="group mt-5 flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5 transition hover:border-primary/40 hover:bg-primary/10"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Sırada
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
              {siradaki.etiket}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{siradaki.aciklama}</p>
          </div>
          <ArrowRight
            className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}
