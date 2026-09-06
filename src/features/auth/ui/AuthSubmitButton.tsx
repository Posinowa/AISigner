import { PosinowaYukleniyor } from "@/features/brand/ui/PosinowaYukleniyor";

/**
 * #153: Auth formlarının ortak gönder düğmesi.
 * Bekleme durumunda `aria-busy` ile ekran okuyucuya da bildirilir.
 *
 * #285: Bekleme göstergesi jenerik bir spinner değil, çizilen Posinowa
 * logosu. Yanında zaten `pendingLabel` metni olduğu için gösterge
 * dekoratif — ekran okuyucuya iki kez duyurulmasın.
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
          <PosinowaYukleniyor boyut={18} dekoratif />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}
