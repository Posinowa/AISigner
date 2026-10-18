import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/nextauth";
import { mentorProfilKurulumKaydiniGetir } from "@/features/mentors/server/profil-kurulum-sorgu";
import { MentorBasvuruForm } from "@/features/mentors/ui/MentorBasvuruForm";

export const dynamic = "force-dynamic";

/**
 * #287: Mentör başvurusunun soruları.
 *
 * Hesap PENDING iken doldurulur — onay bu adımdan SONRA geliyor. Middleware'de
 * bu yola özel izin var (`isMentorProfileCompletionRoute`); mentör alanının
 * geri kalanına onaysız girilemiyor.
 *
 * Daha önce doldurulmuşsa form kayıtlı cevaplarla açılır: onay beklerken
 * düzeltme yapmak yasak değil.
 */
export default async function MentorProfileSetupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const mevcut = await mentorProfilKurulumKaydiniGetir(session.user.id);

  const ad = session.user.name?.split(" ")[0] ?? "Mentör";

  return (
    <div className="mx-auto max-w-3xl p-6 pb-16">
      <div className="mb-8 mt-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {mevcut ? "Başvurunu güncelle" : `Hoş geldin, ${ad}`}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          {mevcut
            ? "Onay beklerken cevaplarını düzeltebilirsin."
            : "Seni doğru stajyerlerle eşleştirebilmemiz için birkaç sorumuz var. Cevapların onay değerlendirmesinde ve eşleştirmede kullanılacak."}
        </p>
      </div>

      <MentorBasvuruForm
        initial={
          mevcut
            ? {
                title: mevcut.title,
                company: mevcut.company ?? undefined,
                yearsExperience: mevcut.yearsExperience,
                seniority: mevcut.seniority as "junior" | "mid" | "senior" | "lead",
                expertise: mevcut.expertise,
                capacity: mevcut.capacity,
                weeklyHours: mevcut.weeklyHours,
                motivation: mevcut.motivation,
                mentoringStyle: mevcut.mentoringStyle,
                githubUrl: mevcut.githubUrl ?? undefined,
                linkedinUrl: mevcut.linkedinUrl ?? undefined,
                city: mevcut.city ?? undefined,
              }
            : undefined
        }
      />
    </div>
  );
}
