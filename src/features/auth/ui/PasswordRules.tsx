import { CheckCircle2 } from "lucide-react";
import { passwordRules, countMetRules } from "@/features/auth/password-rules";

/**
 * #156: Şifre kuralları göstergesi (kayıt + şifre sıfırlama ortak).
 *
 * Liste görsel bir yardımcı; renk/ikon değişimi ekran okuyucuya bir şey
 * anlatmadığı için `aria-hidden`. Onun yerine sağlanan kural sayısı
 * `aria-live` ile özetlenir — kullanıcı yazdıkça ilerlemeyi duyar.
 */
export function PasswordRules({ password }: { password: string }) {
  if (password.length === 0) return null;

  const met = countMetRules(password);

  return (
    <>
      <p className="sr-only" aria-live="polite">
        Şifre kurallarından {met} / {passwordRules.length} tanesi sağlandı.
      </p>

      <div
        className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1"
        aria-hidden="true"
      >
        {passwordRules.map((rule) => {
          const ok = rule.test(password);
          return (
            <p
              key={rule.label}
              className={`flex items-center text-[11px] gap-1 ${
                ok ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <CheckCircle2
                className={`w-3 h-3 shrink-0 ${ok ? "text-emerald-500" : "text-slate-300"}`}
              />
              {rule.label}
            </p>
          );
        })}
      </div>
    </>
  );
}
