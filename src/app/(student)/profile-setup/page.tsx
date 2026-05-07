import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db";
import OnboardingForm from "@/features/student/ui/OnboardingForm";

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

  return (
    <OnboardingForm
      initial={{
        firstName: user?.name ?? undefined,
        lastName: user?.lastName ?? undefined,
        phoneNumber: user?.phone ?? undefined,
      }}
    />
  );
}
