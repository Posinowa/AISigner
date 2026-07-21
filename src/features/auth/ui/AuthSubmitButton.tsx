import { Loader2 } from "lucide-react";

/**
 * #153: Auth formlarının ortak gönder düğmesi.
 * Bekleme durumunda `aria-busy` ile ekran okuyucuya da bildirilir.
 */
export function AuthSubmitButton({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="w-full mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 font-semibold text-white shadow-md shadow-blue-200 transition-all focus:outline-none focus:ring-3 focus:ring-blue-300 disabled:opacity-60 flex items-center justify-center gap-2"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}
