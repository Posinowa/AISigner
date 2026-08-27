import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { prisma } from "@/lib/db";
import { Clock, XCircle, UserPen, GraduationCap, Sparkles, Award } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Onaylanmamış / Mezun stajyer hesapları için durum ekranı.
 * - PENDING → onay bekleme ekranı
 * - REJECTED → reddedilme ekranı
 * - GRADUATED → staj tamamlama tebrik ekranı
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

  const isGraduated = status === "GRADUATED";
  const rejected = status === "REJECTED";

  // #143: Onay artık profil tamamlandıktan SONRA anlam taşıyor. Profilini henüz
  // doldurmamış PENDING kullanıcıyı beklemeye değil, profil tamamlamaya yönlendir.
  //
  // #250: Mentör başvurusu da bu ekrana düşüyor (onay kapısı #249 ile mentörü
  // de kapsıyor). Mentörün dolduracağı bir STAJYER profili yok — sorgu bile
  // atılmıyor, "profilini tamamla" yönlendirmesi gösterilmiyor.
  const mentorBasvurusu = session.user.role === "MENTOR";

  const profile = rejected || isGraduated || mentorBasvurusu
    ? null
    : await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
  const needsProfile = !rejected && !isGraduated && !mentorBasvurusu && !profile;

  // #287: Mentörün de dolduracağı bir profil VAR artık. Başvuru soruları
  // olmadan admin onay kararını ad-soyada bakarak veriyordu.
  const mentorProfile = mentorBasvurusu && !rejected
    ? await prisma.mentorProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null;
  const needsMentorProfile = mentorBasvurusu && !rejected && !mentorProfile;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-200/60 overflow-hidden">
          <div
            className={`h-2 ${
              isGraduated
                ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500"
                : rejected
                  ? "bg-gradient-to-r from-red-500 via-rose-500 to-orange-500"
                  : "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500"
            }`}
          />
          <div className="p-8 sm:p-10 text-center">
            <div
              className={`mx-auto mb-5 h-20 w-20 rounded-3xl flex items-center justify-center shadow-inner ${
                isGraduated
                  ? "bg-gradient-to-br from-purple-50 to-emerald-50 ring-4 ring-purple-100"
                  : rejected
                    ? "bg-red-50"
                    : "bg-amber-50"
              }`}
            >
              {isGraduated ? (
                <GraduationCap className="w-10 h-10 text-purple-600 animate-pulse" />
              ) : rejected ? (
                <XCircle className="w-8 h-8 text-red-600" />
              ) : needsProfile ? (
                <UserPen className="w-8 h-8 text-amber-600" />
              ) : (
                <Clock className="w-8 h-8 text-amber-600" />
              )}
            </div>

            {isGraduated && (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Tebrikler • Staj Tamamlandı
              </span>
            )}

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isGraduated
                ? "Stajınız Başarıyla Tamamlandı!"
                : rejected
                  ? "Başvurunuz reddedildi"
                  : needsProfile
                    ? "Profilinizi tamamlayın"
                    : mentorBasvurusu
                      ? "Mentör başvurunuz inceleniyor"
                      : "Hesabınız inceleniyor"}
            </h1>

            <p className="mt-3.5 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              {isGraduated ? (
                <>
                  <span className="font-semibold text-slate-900">
                    Posinowa bünyesinde yaptığınız staj başarıyla tamamlanmıştır.
                  </span>{" "}
                  Gelecek kariyerinizde ve profesyonel hayatınızda başarılarınızın devamını dileriz!
                </>
              ) : rejected ? (
                "Hesabınız bir yönetici tarafından reddedildi. Bir hata olduğunu düşünüyorsanız lütfen ekiple iletişime geçin."
              ) : needsProfile ? (
                "Değerlendirmeye alınabilmeniz için önce profilinizi doldurmanız gerekiyor. Profiliniz, size en uygun mentörün belirlenmesinde kullanılacak."
              ) : mentorBasvurusu ? (
                needsMentorProfile
                  ? "Başvurunuzu tamamlamak için birkaç sorumuz var. Cevaplarınız gelmeden değerlendirme başlamıyor."
                  : "Mentör başvurunuz ekibimize ulaştı ve inceleniyor. Onaylandığında mentör panelinize erişebileceksiniz. Teşekkürler!"
              ) : (
                "Profiliniz alındı ve inceleniyor. Size uygun bir mentör atandıktan sonra panelinize erişebileceksiniz. Teşekkürler!"
              )}
            </p>

            {isGraduated && (
              <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <Award className="w-4 h-4" />
                  <span>Staj Süreci & Yol Haritası Tamamlandı</span>
                </div>
                <p className="text-slate-500 leading-relaxed">
                  Staj süresince göstermiş olduğunuz özveri ve emekleriniz için teşekkür ederiz. Hesabınız mezun statüsünde arşivlenmiştir.
                </p>
              </div>
            )}

            {/* #287: Sorularını henüz cevaplamamış mentör için doğrudan aksiyon. */}
            {needsMentorProfile && (
              <div className="mt-6">
                <Link
                  href="/mentor-profile-setup"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary transition-all"
                >
                  Başvurumu Tamamla
                </Link>
              </div>
            )}

            {/* #143: Profilsiz PENDING kullanıcı için doğrudan aksiyon. */}
            {needsProfile && (
              <div className="mt-6">
                <Link
                  href="/profile-setup"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary transition-all"
                >
                  Profilimi Tamamla
                </Link>
              </div>
            )}

            {session.user.email && (
              <p className="mt-5 text-xs text-slate-400">
                Giriş yapılan hesap: <span className="font-medium text-slate-500">{session.user.email}</span>
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
