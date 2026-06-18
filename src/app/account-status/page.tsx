import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { Clock, XCircle } from "lucide-react";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-200/60 overflow-hidden">
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
                rejected ? "bg-red-50" : "bg-amber-50"
              }`}
            >
              {rejected ? (
                <XCircle className="w-8 h-8 text-red-600" />
              ) : (
                <Clock className="w-8 h-8 text-amber-600" />
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              {rejected ? "Başvurunuz reddedildi" : "Hesabınız onay bekliyor"}
            </h1>

            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              {rejected
                ? "Hesabınız bir yönetici tarafından reddedildi. Bir hata olduğunu düşünüyorsanız lütfen ekiple iletişime geçin."
                : "Kaydınız başarıyla alındı. Bir yönetici hesabınızı onayladıktan sonra panelinize erişebileceksiniz. Teşekkürler!"}
            </p>

            {session.user.email && (
              <p className="mt-4 text-xs text-slate-400">
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
