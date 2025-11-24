import { getMockProfileSummary } from "@/features/student/server/profileSummary"
import { ProfileSummaryCard } from "@/features/student/ui/ProfileSummaryCard"
//import { db } from "@/lib/db"
import { prisma } from "@/lib/db"


import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/nextauth"

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return <p>Oturum açmanız gerekiyor.</p>

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  })

   if (!profile) {
    return (
      <div className="max-w-2xl mx-auto mt-10 space-y-4">
        <h1 className="text-2xl font-bold">Hoş geldin 👋</h1>
        <p className="text-gray-700">
          Onboarding verin bulunamadı. Lütfen formu tamamlayarak profilini oluştur.
        </p>
      </div>
    )
  }




  //if (!profile) return <p>Onboarding verisi bulunamadı.</p>

  const summaryData = await getMockProfileSummary({
    experienceLevel: profile.experienceLevel,
    interests: profile.interests,
    goals: profile.goals ?? "Henüz hedef belirtilmemiş",
  })
  
  const firstName = session.user.name?.split(" ")[0] ?? "öğrenci"



  return (
    <div className="max-w-2xl mx-auto mt-10 space-y-6">
      
      <h1 className="text-2xl font-bold mt-4">Hoş geldin,{firstName} </h1>
      <p className="text-gray-700">
        Profilin başarıyla oluşturuldu. Bir sonraki adım: <strong>Mentor eşleşmesini beklemek</strong> </p>

      <ProfileSummaryCard
        level={summaryData.level}
        tracks={summaryData.tracks}
        summary={summaryData.summary}
      />

      {/* Proje durumu */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">Proje Durumu</h2>
        <p className="text-gray-700 mt-2">
          Henüz proje atanmadı. Mentor eşleşmesi tamamlandığında projen burada görünecek.
        </p>

        {/*
          İleride Project şeması oluşturulduğunda:
          - StudentProfile modeline projectId (relation) eklenir
          - projectId varsa, <ProjectCard project={project} /> bileşeni render edilir
          - project verisi prisma.project.findUnique() ile çekilir
        */}
      </div>




    </div>
  

  )
  
}