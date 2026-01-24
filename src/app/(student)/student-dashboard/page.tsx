import { getMockProfileSummary } from "@/features/student/server/profileSummary";
import { ProfileSummaryCard } from "@/features/student/ui/ProfileSummaryCard";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { BookOpen, Clock, CheckCircle, AlertCircle } from "lucide-react";

// Durumlar için renk ve ikon yapılandırması
const statusConfig = {
  PENDING: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-100 text-green-800", icon: CheckCircle }
};

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return <p>Oturum açmanız gerekiyor.</p>;

 
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      assignedProjects: {
        include: {
          projectTemplate: true, // Projenin başlık, açıklama vb. detaylarını almak için
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto mt-10 space-y-4">
        <h1 className="text-2xl font-bold">Hoş geldin 👋</h1>
        <p className="text-gray-700">
          Onboarding verin bulunamadı. Lütfen formu tamamlayarak profilini oluştur.
        </p>
      </div>
    );
  }

  const summaryData = await getMockProfileSummary({
    experienceLevel: profile.experienceLevel,
    interests: profile.interests,
    goals: profile.goals ?? "Henüz hedef belirtilmemiş",
  });

  const firstName = session.user.name?.split(" ")[0] ?? "Öğrenci";

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 space-y-8">
      
      {/* Başlık ve Karşılama */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Hoş geldin, {firstName} 👋</h1>
        <p className="text-gray-600 mt-2">
          {profile.mentorId 
            ? "Mentörün senin için bir yol haritası hazırlıyor." 
            : "Profilin başarıyla oluşturuldu. Mentor eşleşmesini bekliyoruz."}
        </p>
      </div>

      {/* AI Profil Özeti */}
      <ProfileSummaryCard
        level={summaryData.level}
        tracks={summaryData.tracks}
        summary={summaryData.summary}
      />

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <BookOpen className="w-6 h-6 mr-2 text-blue-600" />
          Proje Durumu
        </h2>

        {profile.assignedProjects.length === 0 ? (
          // 🔸 DURUM A: Hiç proje yoksa gösterilecek kısım (Sizin eski mesajınızın olduğu yer)
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-3">
              <Clock className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-medium">Henüz Proje Atanmadı</h3>
            <p className="text-gray-500 mt-1 text-sm">
              Mentörün profilini inceliyor. Yakında senin için uygun bir proje atayacaktır.
            </p>
          </div>
        ) : (
          // 🔸 DURUM B: Proje varsa listelenecek kartlar
          <div className="grid gap-4">
            {profile.assignedProjects.map((project) => {
              // Tip güvenliği için status kontrolü
              const statusKey = project.status as keyof typeof statusConfig;
              const statusInfo = statusConfig[statusKey] || statusConfig.PENDING;
              const StatusIcon = statusInfo.icon;

              return (
                <div key={project.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {project.projectTemplate.title}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {project.projectTemplate.track.map((tag, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>
                  
                  <div className="prose prose-sm text-gray-600 mb-4 line-clamp-3">
                    {project.projectTemplate.description}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-xs text-gray-500">
                      Atanma Tarihi: {new Date(project.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                 
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