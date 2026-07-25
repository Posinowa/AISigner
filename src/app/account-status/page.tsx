import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { prisma } from "@/lib/db";
import { Clock, XCircle, UserPen } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Onaylanmamış stajyer hesapları için durum ekranı.
 * - PENDING → onay bekleme ekranı
 * - REJECTED → reddedilme ekranı
 * - APPROVED (veya status yok) → kullanıcı kendi paneline yönlendirilir
 */
export default async function AccountStatusPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const status = session.user.accountStatus;

  // Onaylı kullanıcının burada işi yok → role göre kendi paneline
  if (!status || status === "APPROVED") {
    const role = session.user.role;
    redirect(
      role === "ADMIN"
        ? "/admin-dashboard"
        : role === "MENTOR"
          ? "/mentor-dashboard"
          : "/student-dashboard",
    );
  }

  const rejected = status === "REJECTED";

  // #143: Onay artık profil tamamlandıktan SONRA anlam taşıyor. Profilini henüz
  // doldurmamış PENDING kullanıcıyı beklemeye değil, profil tamamlamaya yönlendir.
  const profile = rejected
    ? null
    : await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
  const needsProfile = !rejected && !profile;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl ring-1 ring-slate-200/60 overflow-hidden">
          <div
            className={`h-1.5 ${
              rejected
                ? "bg-gradient-to-r from-red-500 via-rose-500 to-orange-500"
                : "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500"
            }`}
          />
          <div className="p-8 sm:p-10 text-center">
            <div
              className={`mx-auto mb-5 h-16 w-16 rounded-2xl flex items-center justify-center ${
                rejected ? "bg-red-50 dark:bg-red-950/40" : "bg-amber-50 dark:bg-amber-950/40"
              }`}
            >
              {rejected ? (
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              ) : needsProfile ? (
                <UserPen className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              ) : (
                <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {rejected
                ? "Başvurunuz reddedildi"
                : needsProfile
                  ? "Profilinizi tamamlayın"
                  : "Hesabınız inceleniyor"}
            </h1>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {rejected
                ? "Hesabınız bir yönetici tarafından reddedildi. Bir hata olduğunu düşünüyorsanız lütfen ekiple iletişime geçin."
                : needsProfile
                  ? "Değerlendirmeye alınabilmeniz için önce profilinizi doldurmanız gerekiyor. Profiliniz, size en uygun mentörün belirlenmesinde kullanılacak."
                  : "Profiliniz alındı ve inceleniyor. Size uygun bir mentör atandıktan sonra panelinize erişebileceksiniz. Teşekkürler!"}
            </p>

            {/* #143: Profilsiz PENDING kullanıcı için doğrudan aksiyon. */}
            {needsProfile && (
              <div className="mt-6">
                <Link
                  href="/profile-setup"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 transition-all"
                >
                  Profilimi Tamamla
                </Link>
              </div>
            )}

            {session.user.email && (
              <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
                Giriş yapılan hesap: <span className="font-medium text-slate-500 dark:text-slate-400">{session.user.email}</span>
              </p>
            )}

            <div className="mt-8 flex justify-center">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
