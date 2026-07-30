"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-slate-100 text-sm shadow-sm focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 outline-none transition";

/**
 * #153: Etiket + input + hata mesajını **erişilebilir şekilde bağlayan** ortak alan.
 *
 * Önceden hata mesajı input'un altında serbest bir `<p>` idi: ekran okuyucu
 * kullanan biri alanın hatalı olduğunu anlayamıyordu. Artık:
 * - hata varken input `aria-invalid="true"` alır,
 * - hata metni `aria-describedby` ile input'a bağlanır,
 * - hata `role="alert"` ile anında seslendirilir.
 */
export function AuthField({
  id,
  name,
  label,
  type = "text",
  errors,
  hint,
  revealable = false,
  belowField,
  ...inputProps
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  errors?: string[];
  /** Etiket yanında gösterilen açıklama, ör. "(opsiyonel)". */
  hint?: string;
  /**
   * Şifre alanları için göster/gizle düğmesi. **Dikkat (#169):** `revealable`
   * verildiğinde input tipi `password`↔`text` arasında bu bileşen tarafından
   * yönetilir; dışarıdan geçilen `type` **yok sayılır**. Yani `revealable` + özel
   * bir `type` (ör. `email`) birlikte anlamlı değildir — biri ya da öteki seçilir.
   */
  revealable?: boolean;
  /** Alanın altına eklenecek içerik (ör. "Şifremi Unuttum" bağlantısı). */
  belowField?: ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "type">) {
  const [revealed, setRevealed] = useState(false);
  const error = errors?.[0];
  const errorId = `${id}-error`;

  const resolvedType = revealable ? (revealed ? "text" : "password") : type;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
        {hint && <span className="text-slate-400 dark:text-slate-500 font-normal"> {hint}</span>}
      </label>

      <div className={revealable ? "relative" : undefined}>
        <input
          id={id}
          name={name}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={revealable ? `${inputClass} pr-11` : inputClass}
          {...inputProps}
        />

        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Şifreyi gizle" : "Şifreyi göster"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {revealed ? (
              <Eye className="w-4.5 h-4.5" aria-hidden="true" />
            ) : (
              <EyeOff className="w-4.5 h-4.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-500 dark:text-red-400">
          {error}
        </p>
      )}

      {belowField}
    </div>
  );
}
