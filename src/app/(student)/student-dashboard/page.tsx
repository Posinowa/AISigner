import { getProfileSummary } from "@/features/student/server/profileSummary";
import { ProfileSummaryCard } from "@/features/student/ui/ProfileSummaryCard";
import { RoadmapSteps } from "@/features/student/ui/RoadmapSteps";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { Clock, Briefcase, Target, Github, GraduationCap, Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { SecurityQuestionsSetup } from "@/features/auth/ui/SecurityQuestionsSetup";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { StudentCertificateTrigger } from "@/features/student/ui/StudentCertificateTrigger";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p>Oturum açmanız gerekiyor.</p>;

  // #38: Onaylanmamış stajyer (PENDING/REJECTED) panele erişemez.
  // GRADUATED stajyerler projelerini ve adımlarını incelemeye devam edebilir.
  const accountStatus = session.user.accountStatus;
  const isGraduated = accountStatus === "GRADUATED";
  if (accountStatus && accountStatus !== "APPROVED" && !isGraduated) {
    const rejected = accountStatus === "REJECTED";
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-10 max-w-lg w-full space-y-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              rejected ? "bg-red-50 dark:bg-red-950/40" : "bg-amber-50 dark:bg-amber-950/40"
            }`}
          >
            <Clock className={`w-8 h-8 ${rejected ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {rejected ? "Başvurunuz reddedildi" : "Hesabınız onay bekliyor"}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {rejected
              ? "Hesabınız bir yönetici tarafından reddedildi. Sorunuz varsa lütfen ekiple iletişime geçin."
              : "Kaydınız alındı. Bir yönetici hesabınızı onayladıktan sonra panele erişebilirsiniz."}
          </p>
        </div>
      </div>
    );
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      assignedProjects: {
        include: {
          projectTemplate: true,
          roadmap: {
            include: {
              steps: {
                orderBy: { order: "asc" }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
      },
      // #195: M:N — "mentörün var mı?" kontrolü için atamalar.
      mentorAssignments: { select: { mentorId: true } },
    },
  });

  if (!profile) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-10 max-w-lg w-full space-y-6">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center mx-auto mb-2">
            <Briefcase className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Kariyer Yolculuğunuz Başlıyor</h1>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Sizi doğru mentörle eşleştirebilmemiz ve sektörel yetkinliklerinize uygun projeler atayabilmemiz için profesyonel profilinizi tamamlamanız gerekmektedir.
          </p>
          <div className="pt-4">
            <Link
              href="/profile-setup"
              className="inline-flex items-center justify-center w-full h-12 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-all"
            >
              Profilimi Oluştur
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const summaryData = await getProfileSummary({
    experienceLevel: profile.experienceLevel,
    interests: profile.interests,
    goals: profile.goals ?? "Henüz hedef belirtilmemiş",
    availability: profile.availability ?? undefined,
    userId: session.user.id, // Cache invalidation için userId gerekli
  });

  const firstName = session.user.name?.split(" ")[0] ?? "Öğrenci";

  return (
    <div className="max-w-5xl mx-auto mt-8 p-6 space-y-8">
      {/* 🎓 Mezun Stajyer Tebrik & Başarı Kartı */}
      {isGraduated && (
        <div className="rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-purple-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-emerald-400 p-0.5 shrink-0 shadow-lg">
                <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-purple-400 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30 mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Posinowa Staj Mezuniyeti
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Stajınız Başarıyla Tamamlandı!
                </h2>
                <p className="mt-2 text-purple-100/90 text-sm sm:text-base leading-relaxed max-w-2xl">
                  Posinowa bünyesinde yaptığınız staj başarıyla tamamlanmıştır. Çalıştığınız projeleri, tamamladığınız yol haritası adımlarını ve tüm dosya/geliştirme geçmişinizi aşağıda incelemeye devam edebilirsiniz. Gelecek kariyerinizde ve profesyonel hayatınızda başarılarınızın devamını dileriz!
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" /> Staj Tamamlandı
              </span>
              <StudentCertificateTrigger />
            </div>
          </div>
        </div>
      )}

      {/* Sayfa başlığı — navigasyon/çıkış AppShell'de (#126-1) */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {isGraduated ? `Mezun Stajyer Portfolyosu: ${firstName}` : `Hoş geldin, ${firstName}`}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
          {isGraduated
            ? "Staj süreciniz boyunca geliştirdiğiniz projeler, tamamlanan adımlar ve çıktılar aşağıda arşivlenmiştir."
            : profile.assignedProjects.length > 0
              ? "Çalışma masan hazır. Odaklanman gereken güncel görevler aşağıda listelenmiştir."
              : profile.mentorAssignments.length > 0
                ? "Mentörün gelişim planını hazırlıyor. Lütfen beklemede kal."
                : "Profilin inceleniyor. Yakında bir mentör ile eşleştirileceksin."}
        </p>
      </div>

      {/* Güvenlik Soruları Kurulumu */}
      <SecurityQuestionsSetup />

      <ProfileSummaryCard
        level={summaryData.level}
        tracks={summaryData.tracks}
        summary={summaryData.summary}
        recommendations={summaryData.recommendations}
      />

      {/* Projeler ve Yol Haritası */}
      <div>
        <h2 className="text-xl font-bold mb-6 flex items-center text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3">
          <Target className="w-5 h-5 mr-2 text-slate-700 dark:text-slate-200" />
          Aktif Projeler ve İş Akışı
        </h2>

        {profile.assignedProjects.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center">
            <Clock className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <h3 className="text-slate-900 dark:text-slate-100 font-semibold text-lg">Bekleyen Görev Yok</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto text-sm">
              Şu anda aktif bir proje atamanız bulunmuyor. Mentörünüz teknik gelişiminize uygun bir yol haritası oluşturduğunda burada görünecektir.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {profile.assignedProjects.map((project) => {
              
              const steps = project.roadmap?.steps || [];
              const totalSteps = steps.length;
              const completedSteps = steps.filter(s => s.status === "COMPLETED").length;
              const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
              const isDraft = project.roadmap?.status === "DRAFT";

              return (
                <div key={project.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                  
                  {/* Proje Üst Bilgi (Header) */}
                  <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md text-xs font-semibold tracking-wide">
                            ANA PROJE
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Atanma: {new Date(project.createdAt).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                        <h3 className="font-bold text-2xl text-slate-900 dark:text-slate-100 tracking-tight">
                          {project.projectTemplate.title}
                        </h3>
                        {/* #91: Açıklama markdown olarak render edilir. */}
                        <MarkdownContent className="mt-2 max-w-3xl">
                          {project.projectTemplate.description}
                        </MarkdownContent>
                        {project.projectTemplate.githubRepoUrl && (
                          <a
                            href={project.projectTemplate.githubRepoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 mt-2 transition-colors"
                          >
                            <Github className="w-3.5 h-3.5" />
                            {project.projectTemplate.githubRepoUrl.replace(/^https:\/\/github\.com\//, "")}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Minimal İlerleme Çubuğu */}
                    <div className="mt-6 max-w-md">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                        <span>Tamamlanma Oranı</span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2 bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>

                  {/* İş Akışı (Roadmap Steps) */}
                  <div className="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-950/50">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center">
                        Proje Aşamaları
                        <span className="ml-3 text-sm font-normal text-slate-500 dark:text-slate-400">
                          ({completedSteps}/{totalSteps} tamamlandı)
                        </span>
                      </h4>
                      {isDraft && (
                        <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-medium border border-amber-200 rounded-md">
                          Taslak (Mentör Onayı Bekliyor)
                        </span>
                      )}
                    </div>

                    {totalSteps === 0 ? (
                      <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300">
                        <p className="text-slate-500 dark:text-slate-400 text-sm">İş akışı oluşturuluyor...</p>
                      </div>
                    ) : (
                      <RoadmapSteps
                        steps={steps}
                        isDraft={isDraft}
                        isGraduated={isGraduated}
                        currentUserId={session.user.id}
                        currentUserRole={session.user.role}
                      />
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}