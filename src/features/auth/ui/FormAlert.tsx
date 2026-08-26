import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * #153: Form geneli bildirim kutusu (hata / başarı).
 *
 * Kritik nokta `role`: hata kutusu `role="alert"` ile **anında** seslendirilir,
 * başarı kutusu `role="status"` ile kullanıcının işini bölmeden okunur.
 * Önceden ikisi de düz `<div>` olduğu için ekran okuyucuya hiç ulaşmıyordu —
 * giriş başarısız olduğunda kullanıcı "hiçbir şey olmadı" sanıyordu.
 */
export function FormAlert({
  variant,
  title,
  children,
}: {
  variant: "error" | "success";
  title?: string;
  children: ReactNode;
}) {
  if (variant === "success") {
    return (
      <div
        role="status"
        className="mb-6 flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3"
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          {title && <p className="text-sm font-semibold text-emerald-800">{title}</p>}
          <p className="text-xs text-emerald-600 mt-0.5">{children}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600"
    >
      {children}
    </div>
  );
}
