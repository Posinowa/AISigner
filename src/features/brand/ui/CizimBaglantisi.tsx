"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GecisPerdesi } from "./GecisPerdesi";

/**
 * #285: Tıklanınca önce logoyu ÇİZEN, sonra bağlantıyı açan CTA.
 *
 * Açılış sayfasındaki "Giriş yap" / "Kayıt ol" / "Mentör başvurusu"
 * butonları için. Amaç süsleme değil: bu üç hedef de sunucu tarafında
 * oturum ve rol kontrolü yapan sayfalar, yani tıklama ile ilk boyanma
 * arasında gerçek bir boşluk var. Perde o boşluğu doldurup markayı
 * gösteriyor.
 *
 * Süre bir TAM çizim turuna eşit (2,6 sn'lik döngünün ilk yarısı): logo
 * tamamlanır tamamlanmaz gidiliyor, yarım kalmış bir çizim görünmüyor.
 */
export const CIZIM_SURESI_MS = 1300;

export function CizimBaglantisi({
  href,
  mesaj,
  className,
  children,
  ...kalan
}: {
  href: string;
  mesaj: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "onClick" | "className">) {
  const router = useRouter();
  const [gecisteMi, setGecisteMi] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kullanıcı beklerken geri giderse zamanlayıcı boşa çalışmasın.
  useEffect(
    () => () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    },
    [],
  );

  const tikla = useCallback(
    (olay: React.MouseEvent<HTMLAnchorElement>) => {
      // Yeni sekmede/pencerede açma niyetini BOZMA.
      if (
        olay.defaultPrevented ||
        olay.button !== 0 ||
        olay.metaKey ||
        olay.ctrlKey ||
        olay.shiftKey ||
        olay.altKey
      ) {
        return;
      }

      // Hareketi azalt: bekletme yok, doğrudan git.
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      olay.preventDefault();
      setGecisteMi(true);
      // Perde açıkken sayfa hazırlansın; süre dolduğunda gidiş anlık olsun.
      router.prefetch(href);
      zamanlayici.current = setTimeout(() => router.push(href), CIZIM_SURESI_MS);
    },
    [href, router],
  );

  return (
    <>
      <Link href={href} className={className} onClick={tikla} {...kalan}>
        {children}
      </Link>
      {gecisteMi ? <GecisPerdesi mesaj={mesaj} /> : null}
    </>
  );
}
