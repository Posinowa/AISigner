import type { LucideIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * #153: Giriş/kayıt/şifre sıfırlama ekranlarının ortak kart kabuğu.
 *
 * Önceden bu kabuk (gradient şerit + kart + ikon + başlık bloğu) her auth
 * sayfasında birebir tekrarlanıyordu; birinde yapılan düzeltme diğerinde
 * unutuluyordu (#126-1'de panel header'larında yaşadığımızın aynısı).
 */
export function AuthCard({
  icon: Icon,
  title,
  subtitle,
  width = "md",
  children,
  footer,
  titleRef,
}: {
  icon: LucideIcon;
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
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className={`w-full ${width === "lg" ? "max-w-lg" : "max-w-md"}`}>
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl ring-1 ring-slate-200/60 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="p-8 sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <Icon className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <h1
                ref={titleRef}
                tabIndex={titleRef ? -1 : undefined}
                className="text-2xl font-bold text-slate-900 dark:text-slate-100 outline-none"
              >
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>

            {children}
          </div>
        </div>

        {footer}
      </div>
    </div>
  );
}
