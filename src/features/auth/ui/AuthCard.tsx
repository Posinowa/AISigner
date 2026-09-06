import Image from "next/image";
import type { ReactNode, Ref } from "react";

/**
 * #153: Giriş/kayıt/şifre sıfırlama ekranlarının ortak kart kabuğu.
 *
 * Önceden bu kabuk (gradient şerit + kart + ikon + başlık bloğu) her auth
 * sayfasında birebir tekrarlanıyordu; birinde yapılan düzeltme diğerinde
 * unutuluyordu (#126-1'de panel header'larında yaşadığımızın aynısı).
 */
export function AuthCard({
  title,
  subtitle,
  width = "md",
  children,
  footer,
  titleRef,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Kayıt formu daha geniş (iki sütunlu ad/soyad) olduğu için ayarlanabilir. */
  width?: "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
  /**
   * #156: Çok adımlı akışlarda adım değişince odağın başlığa taşınabilmesi için.
   * Odaklanabilir olması gerektiğinden başlık `tabIndex={-1}` alır.
   */
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className={`w-full ${width === "lg" ? "max-w-lg" : "max-w-md"}`}>
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          <div className="h-1 bg-primary" />

          <div className="p-8 sm:p-10">
            <div className="mb-8 text-center">
              {/*
                #237: Jenerik lucide ikonu yerine AISigner markasi. Acilis
                sayfasindan gelen kullanici ayni markayi goruyor; sayfanin
                hangisi oldugunu zaten baslik soyluyor.
              */}
              <Image
                src="/brand/aisigner-mark.png"
                alt="AISigner"
                width={52}
                height={45}
                priority
                className="mx-auto mb-4 h-11 w-auto"
              />
              <h1
                ref={titleRef}
                tabIndex={titleRef ? -1 : undefined}
                className="text-2xl font-bold text-slate-900 outline-none"
              >
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
            </div>

            {children}
          </div>
        </div>

        {footer}
      </div>
    </div>
  );
}
