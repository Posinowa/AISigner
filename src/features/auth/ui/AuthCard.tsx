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
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className={`w-full ${width === "lg" ? "max-w-lg" : "max-w-md"}`}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="h-1 bg-indigo-600" />

          <div className="p-8 sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
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
