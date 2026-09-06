import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { redirect } from "next/navigation";
import { MentorProjeler } from "@/features/projects/ui/MentorProjeler";

/**
 * #253: Mentörün proje şablonu sayfası.
 *
 * Şablon yönetimi bugüne kadar yalnızca /admin-dashboard/projects altındaydı
 * ve o rota mentöre kapalı. Mentör artık kendi şablonunu buradan oluşturup
 * düzenleyebiliyor; başkasınınkini yalnızca görüyor.
 */
export default async function MentorProjelerSayfasi() {
  const session = await getServerSession(authOptions);

  // Layout zaten MENTOR kontrolü yapıyor; burada yalnızca kimliği alıyoruz.
  if (!session?.user?.id) redirect("/signin");

  return <MentorProjeler kullaniciId={session.user.id} />;
}
