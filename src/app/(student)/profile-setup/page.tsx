import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db";
import OnboardingForm from "@/features/student/ui/OnboardingForm";
import { listSurveyQuestions } from "@/features/survey/server/survey";
import type { SurveyQuestionView } from "@/features/survey/answers";

export const dynamic = "force-dynamic";

export default async function ProfileSetupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  // Signup'ta girilen ad/soyad/telefonu User tablosundan çek; onboarding form'unda
  // prefill olarak göster — kullanıcı tekrar girmek zorunda kalmasın.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, lastName: true, phone: true },
  });

  // #55: Mevcut StudentProfile varsa (öğrenci daha önce onboarding'i tamamlamışsa)
  // formu boş değil, kayıtlı verilerle önceden doldur.
  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      birthYear: true,
      experienceLevel: true,
      interests: true,
      goals: true,
      availability: true,
      // #289: Genişletilen sorular da prefill edilmeli — yoksa profilini
      // tekrar açan stajyer bunları BOŞ görüp baştan doldurur.
      city: true,
      gitLevel: true,
      weeklyHours: true,
      school: true,
      department: true,
      classYear: true,
      englishLevel: true,
    },
  });

  // #46: Admin'in tanımladığı aktif anket sorularını göster. Hata olursa form
  // mevcut akışı bozmadan çalışmalı → boş dizi ile devam et.
  // #83: Ama "gerçekten hiç soru yok" ile "yükleme başarısız oldu" aynı boş
  // diziyle sonuçlanmasın diye ayrı bir flag taşınıyor — form bunu görüp
  // kullanıcıya açık bir hata mesajı gösterebiliyor.
  let surveyQuestions: SurveyQuestionView[] = [];
  let surveyLoadFailed = false;
  try {
    const questions = await listSurveyQuestions({ activeOnly: true });
    surveyQuestions = questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
    }));
  } catch (error) {
    console.error("profile-setup: anket soruları yüklenemedi", error);
    surveyLoadFailed = true;
  }

  return (
    <OnboardingForm
      initial={{
        firstName: user?.name ?? undefined,
        lastName: user?.lastName ?? undefined,
        phoneNumber: user?.phone ?? undefined,
        birthYear: studentProfile?.birthYear ?? undefined,
        experienceLevel: studentProfile?.experienceLevel ?? undefined,
        interests: studentProfile?.interests ?? undefined,
        goals: studentProfile?.goals ?? undefined,
        availability: studentProfile?.availability ?? undefined,
        city: studentProfile?.city ?? undefined,
        gitLevel: studentProfile?.gitLevel ?? undefined,
        weeklyHours: studentProfile?.weeklyHours ?? undefined,
        school: studentProfile?.school ?? undefined,
        department: studentProfile?.department ?? undefined,
        classYear: studentProfile?.classYear ?? undefined,
        englishLevel: studentProfile?.englishLevel ?? undefined,
      }}
      surveyQuestions={surveyQuestions}
      surveyLoadFailed={surveyLoadFailed}
    />
  );
}
