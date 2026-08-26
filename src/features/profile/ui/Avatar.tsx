/**
 * #265: Profil fotoğrafı; yoksa baş harflere düşer.
 *
 * `next/image` BİLEREK kullanılmıyor: görsel optimizasyonu resmi sunucu
 * tarafından, kullanıcının çerezleri OLMADAN çekiyor. Fotoğraf ucu oturum
 * istediği için optimizatör 401 alır ve resim hiç görünmez.
 */

type Props = {
  userId: string;
  /** Fotoğraf yoksa gösterilecek baş harfler. */
  basHarfler: string;
  /** Kullanıcının fotoğrafı var mı — gereksiz 404 isteği atmamak için. */
  fotografVar: boolean;
  ad?: string;
  boyutSinifi?: string;
  arkaPlanSinifi?: string;
};

export function Avatar({
  userId,
  basHarfler,
  fotografVar,
  ad,
  boyutSinifi = "w-11 h-11",
  arkaPlanSinifi = "bg-gradient-to-br from-emerald-500 to-teal-600",
}: Props) {
  const ortak = `${boyutSinifi} rounded-2xl shrink-0 shadow-sm object-cover`;

  if (fotografVar) {
    return (
      /* Optimizatör oturum çerezi taşımadığı için bu uçtan resim çekemez
         (gerekçe dosya başında). */
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/users/${userId}/avatar`}
        alt={ad ? `${ad} profil fotoğrafı` : "Profil fotoğrafı"}
        className={ortak}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${ortak} ${arkaPlanSinifi} flex items-center justify-center text-white font-bold text-sm`}
    >
      {basHarfler}
    </div>
  );
}
