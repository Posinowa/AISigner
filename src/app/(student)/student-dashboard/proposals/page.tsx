import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { authOptions } from "@/lib/auth/nextauth";
import { ProjeOnerisi } from "@/features/proposals/ui/ProjeOnerisi";

/**
 * Kendi projeni öner — kendi sayfası (#420).
 *
 * ⚠️ #415'te bu form katlanır bloğa alınmıştı; ölçüm 745px olduğunu ve ÜÇ
 * ADIM KARTININ TOPLAMINDAN büyük olduğunu göstermişti. Katlamak yüksekliği
 * çözdü ama form hâlâ çalışma masasının içindeydi. Yılda bir kez kullanılan
 * bir araç orada durmamalı.
 *
 * ⚠️ MEZUN STAJYER ÖNERİ YAZAMAZ (#208: sistem durumunu değiştiren uçlar
 * kapalı). Menüde bağlantı da gösterilmiyor; buraya doğrudan gelinirse
 * panoya dönülüyor — erişemeyeceği bir formu göstermek yanıltıcı olurdu.
 */
export const dynamic = "force-dynamic";

export default async function ProjeOnerisiSayfasi() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");
  if (session.user.accountStatus === "GRADUATED") redirect("/student-dashboard");

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        <Lightbulb className="h-5 w-5 text-blue-600" />
        Kendi Projeni Öner
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        Hazır projelerden birini seçmek yerine kendi fikrini önerebilirsin.
        Yöneticin onaylarsa proje sana atanır ve yol haritan çıkarılır.
      </p>

      <div className="mt-5">
        <ProjeOnerisi />
      </div>
    </div>
  );
}
