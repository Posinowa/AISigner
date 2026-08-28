import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db";
import { ProfileSummarySection } from "@/features/student/ui/ProfileSummarySection";

export const dynamic = "force-dynamic";

/**
 * #306: AI profil analizi — kendi sayfasında.
 *
 * Önceden panonun içinde, karşılamanın hemen altında duruyordu. Analiz yavaş
 * değişen bir içerik (profil güncellenmedikçe aynı kalıyor) ama kullanıcı her
 * girişte onu görmek ve asıl işine — projeler ve adımlara — ulaşmak için
 * üzerinden geçmek zorundaydı.
 *
 * Artık menüden isteyince bakılan bir yer. Kaybolmuyor, sadece yolun ortasında
 * durmuyor.
 */
export default async function AiAnalizPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      experienceLevel: true,
      interests: true,
      goals: true,
      availability: true,
    },
  });

  // Profil yoksa analiz edilecek bir şey de yok; panodaki akışın aynısı.
  if (!profile) redirect("/profile-setup");

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 pb-16 pt-8">
      <div>
        <Link
          href="/student-dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Panele dön
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          AI Profil Analizim
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          Başvuruda verdiğin cevaplardan üretildi. Profilini güncellersen analiz
          de yenilenir.
        </p>
      </div>

      <ProfileSummarySection
        girdi={{
          experienceLevel: profile.experienceLevel,
          interests: profile.interests,
          goals: profile.goals ?? "Henüz hedef belirtilmemiş",
          availability: profile.availability ?? undefined,
          // Önbellek geçersizleştirme için gerekli.
          userId: session.user.id,
        }}
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Analiz eskimiş mi?</p>
        <p className="mt-1 text-xs text-slate-500">
          Deneyimin veya hedeflerin değiştiyse profilini güncelle; analiz yeni
          cevaplarına göre yeniden üretilir.
        </p>
        <Link
          href="/profile-setup"
          className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          Profilimi güncelle
        </Link>
      </div>
    </div>
  );
}
