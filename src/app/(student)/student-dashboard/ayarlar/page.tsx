import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db";
import { panoErisimineAcik, DURUM_EKRANI } from "@/lib/auth/hesap-durumu";
import { AvatarUpload } from "@/features/profile/ui/AvatarUpload";
import { TakilmaBildirimiAyari } from "@/features/radar/ui/TakilmaBildirimiAyari";

/**
 * Öğrenci ayarlar sayfası (#538).
 *
 * Ana panodaki katlanır idari bloktan üst menüye ("Mentör Görüşmesi" yanına)
 * taşındı. Profil fotoğrafı ve takılma bildirimi tercihlerini barındırır.
 *
 * ⚠️ MEZUN STAJYER ERİŞEBİLİR: Profil fotoğrafını güncelleme hakkı mezun için
 * de geçerlidir. Ancak takılma bildirimi yalnız aktif stajyerlerde gösterilir.
 */
export const dynamic = "force-dynamic";

export default async function StudentSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const accountStatus = session.user.accountStatus;
  const isGraduated = accountStatus === "GRADUATED";
  if (!panoErisimineAcik(accountStatus)) {
    redirect(DURUM_EKRANI);
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { takilmaBildirimi: true },
  });

  const firstName = session.user.name?.split(" ")[0] ?? "Öğrenci";
  const basHarfler = firstName.slice(0, 2).toUpperCase();
  const fotografVar = session.user.fotografVar === true;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
          <Settings className="h-6 w-6 text-blue-600" />
          Ayarlar
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Profil fotoğrafınızı ve çalışma alanı bildirim tercihlerinizi buradan yönetebilirsiniz.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profil fotoğrafı yönetimi — #profil çapası profil tamamlama şeridinden hedeflenir */}
        <section
          id="profil"
          className="scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Profil Fotoğrafı</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Mentörünüzün ve takım arkadaşlarınızın sizi tanıması için güncel bir fotoğraf yükleyin.
            </p>
          </div>
          <AvatarUpload
            userId={session.user.id}
            basHarfler={basHarfler}
            fotografVar={fotografVar}
            ad={session.user.name}
          />
        </section>

        {/* Takılma bildirimi tercihi — yalnız aktif stajyerlere açıktır */}
        {!isGraduated && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <TakilmaBildirimiAyari baslangic={profile?.takilmaBildirimi ?? false} />
          </section>
        )}
      </div>
    </div>
  );
}
