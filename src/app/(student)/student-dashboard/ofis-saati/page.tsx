import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { authOptions } from "@/lib/auth/nextauth";
import { OfisSaatiOgrenci } from "@/features/ofis-saati/ui/OfisSaatiOgrenci";

/**
 * Mentör görüşmesi — kendi sayfası (#420).
 *
 * ⚠️ MEZUN STAJYER REZERVE EDEBİLİR. #398'de bilinçli karar: #208 ayrımında
 * *sistem durumunu değiştiren* ve *ücretli AI* uçları mezuna kapalı, *insan
 * iletişimi* açık. Görüşme mesajlaşmanın eşi (referans, kariyer tavsiyesi) ve
 * kıtlık mentörün kendi kontrolünde — slotu o açıyor. Bu yüzden burada
 * öneri sayfasındaki GRADUATED kapısı YOK.
 */
export const dynamic = "force-dynamic";

export default async function OfisSaatiSayfasi() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        <CalendarClock className="h-5 w-5 text-blue-600" />
        Mentör Görüşmesi
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        Mentörünün açtığı 20 dakikalık dilimlerden birini rezerve et. Görüşme
        bağlantısını rezervasyondan sonra göreceksin.
      </p>

      <div className="mt-5">
        <OfisSaatiOgrenci kullaniciId={session.user.id} />
      </div>
    </div>
  );
}
