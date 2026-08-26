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
      className="w-full mt-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-3 font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 flex items-center justify-center gap-2"
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
