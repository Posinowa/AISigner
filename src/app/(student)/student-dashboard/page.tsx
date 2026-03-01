import LogoutButton from "@/components/LogoutButton";
import { getProfileSummary } from "@/features/student/server/profileSummary";
import { ProfileSummaryCard } from "@/features/student/ui/ProfileSummaryCard";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { BookOpen, Clock, CheckCircle2, Circle, Lock, Rocket, Target, Briefcase, PlayCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";

const statusConfig = {
  PENDING: { label: "Bekliyor", color: "bg-slate-100 text-slate-600", icon: Clock },
  IN_PROGRESS: { label: "Geliştiriliyor", color: "bg-blue-100 text-blue-700", icon: PlayCircle },
  COMPLETED: { label: "Tamamlandı", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 }
};

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p>Oturum açmanız gerekiyor.</p>;

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
    },
  });

  if (!profile) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center relative">
        <div className="absolute top-4 right-4">
            <LogoutButton />
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-10 max-w-lg w-full space-y-6">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <Briefcase className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Kariyer Yolculuğunuz Başlıyor</h1>
          <p className="text-slate-600 leading-relaxed">
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
  });

  const firstName = session.user.name?.split(" ")[0] ?? "Öğrenci";

  return (
    <div className="max-w-5xl mx-auto mt-8 p-6 space-y-8">
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hoş geldin, {firstName}</h1>
          <p className="text-slate-500 mt-2 text-sm">
            {profile.assignedProjects.length > 0 
              ? "Çalışma masan hazır. Odaklanman gereken güncel görevler aşağıda listelenmiştir." 
              : profile.mentorId 
                ? "Mentörün gelişim planını hazırlıyor. Lütfen beklemede kal." 
                : "Profilin inceleniyor. Yakında bir mentör ile eşleştirileceksin."}
          </p>
        </div>
        <LogoutButton />
      </div>

      <ProfileSummaryCard
        level={summaryData.level}
        tracks={summaryData.tracks}
        summary={summaryData.summary}
        recommendations={summaryData.recommendations}
      />

      {/* Projeler ve Yol Haritası */}
      <div>
        <h2 className="text-xl font-bold mb-6 flex items-center text-slate-900 border-b border-slate-200 pb-3">
          <Target className="w-5 h-5 mr-2 text-slate-700" />
          Aktif Projeler ve İş Akışı
        </h2>

        {profile.assignedProjects.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center">
            <Clock className="w-10 h-10 text-slate-400 mx-auto mb-4" />
            <h3 className="text-slate-900 font-semibold text-lg">Bekleyen Görev Yok</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
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
                <div key={project.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  
                  {/* Proje Üst Bilgi (Header) */}
                  <div className="p-6 md:p-8 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold tracking-wide">
                            ANA PROJE
                          </span>
                          <span className="text-xs text-slate-500 flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Atanma: {new Date(project.createdAt).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                        <h3 className="font-bold text-2xl text-slate-900 tracking-tight">
                          {project.projectTemplate.title}
                        </h3>
                        <p className="text-slate-600 mt-2 text-sm max-w-3xl leading-relaxed">
                          {project.projectTemplate.description}
                        </p>
                      </div>
                    </div>

                    {/* Minimal İlerleme Çubuğu */}
                    <div className="mt-6 max-w-md">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
                        <span>Tamamlanma Oranı</span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2 bg-slate-100" />
                    </div>
                  </div>

                  {/* İş Akışı (Roadmap Steps) */}
                  <div className="p-6 md:p-8 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-semibold text-slate-900 flex items-center">
                        Proje Aşamaları
                        <span className="ml-3 text-sm font-normal text-slate-500">
                          ({completedSteps}/{totalSteps} tamamlandı)
                        </span>
                      </h4>
                      {isDraft && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 rounded-md">
                          Taslak (Mentör Onayı Bekliyor)
                        </span>
                      )}
                    </div>

                    {totalSteps === 0 ? (
                      <div className="text-center py-10 bg-white rounded-lg border border-dashed border-slate-300">
                        <p className="text-slate-500 text-sm">İş akışı oluşturuluyor...</p>
                      </div>
                    ) : (
                      <div className="relative pl-4 md:pl-0">
                        {/* Dikey Çizgi (Timeline) */}
                        <div className="absolute left-[1.35rem] top-2 bottom-2 w-px bg-slate-200 hidden md:block"></div>

                        <div className="space-y-6">
                          {steps.map((step, index) => {
                            const isCompleted = step.status === "COMPLETED";
                            const isInProgress = step.status === "IN_PROGRESS";
                            const isLocked = step.status === "TODO";

                            return (
                              <div key={step.id} className="relative flex items-start gap-4">
                                
                                {/* Status Icon / Timeline Node */}
                                <div className="hidden md:flex relative z-10 items-center justify-center w-11 h-11 rounded-full bg-white border-2 shrink-0 mt-1
                                  ${isCompleted ? 'border-emerald-500' : isInProgress ? 'border-blue-600' : 'border-slate-200'}">
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                  ) : isInProgress ? (
                                    <PlayCircle className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                                  )}
                                </div>

                                {/* Step Card */}
                                <div className={`flex-1 rounded-xl p-5 transition-all border
                                  ${isCompleted ? "bg-white border-slate-200/60" : 
                                    isInProgress ? "bg-white border-blue-200 ring-1 ring-blue-100 shadow-sm" : 
                                    "bg-slate-50/50 border-slate-200 opacity-75"}
                                `}>
                                  
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-xs font-semibold tracking-wider uppercase
                                      ${isCompleted ? "text-emerald-600" : isInProgress ? "text-blue-600" : "text-slate-500"}
                                    `}>
                                      Aşama {step.order}
                                    </span>
                                    
                                    {/* Durum Badge */}
                                    {isInProgress && (
                                      <span className="flex items-center text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse mr-1.5"></span>
                                        Şu Anki Odak
                                      </span>
                                    )}
                                  </div>

                                  <h5 className={`font-semibold text-base mb-2
                                    ${isCompleted ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900"}
                                  `}>
                                    {step.title}
                                  </h5>
                                  
                                  {(!isLocked || isInProgress) && step.description && (
                                    <p className={`text-sm leading-relaxed ${isCompleted ? "text-slate-400" : "text-slate-600"}`}>
                                      {step.description}
                                    </p>
                                  )}

                                  {isLocked && !isCompleted && !isInProgress && (
                                    <div className="flex items-center text-sm text-slate-400 mt-2">
                                      <Lock className="w-3.5 h-3.5 mr-1.5" />
                                      <span>Önceki aşamanın tamamlanması bekleniyor</span>
                                    </div>
                                  )}
                                  
                                  {/* Profesyonel Kaynak Gösterimi */}
                                  {!isLocked && step.resources && step.resources.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                                      {step.resources.map((link, i) => (
                                        <a key={i} href={link} target="_blank" rel="noreferrer" 
                                           className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors">
                                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                          İlgili Doküman / Kaynak {i + 1}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
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