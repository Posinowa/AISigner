import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { LandingPage } from "@/features/landing/ui/LandingPage";

// Uygulamanın giriş noktası: yönlendirme kararı tek yerde (sunucuda) toplanır.
// Signin başarılı olunca "/"'a hard navigation yapar; buradaki server session
// kontrolü role göre doğru panele yönlendirir (client getSession retry'ına gerek yok).
export default async function Home() {
  const session = await getServerSession(authOptions);

  // Oturum yoksa herkese açık açılış sayfası. Middleware "/" için oturumsuz
  // erişime zaten izin veriyor; burada da yönlendirmek yerine sayfayı basıyoruz.
  if (!session) {
    return <LandingPage />;
  }

  // Rolü olmayan oturum = geçersiz (ör. hesabı SİLİNMİŞ kullanıcı; JWT callback rol'ü
  // undefined yapar ama token durur). signin'e gönder → sonsuz yönlendirme döngüsü olmaz.
  if (!session.user?.role) {
    redirect("/signin");
  }

  const role = session.user.role;
  const accountStatus = session.user.accountStatus;

  if (accountStatus === "PENDING" || accountStatus === "REJECTED") {
    redirect("/account-status");
  }
  if (role === "ADMIN") {
    redirect("/admin-dashboard");
  }
  if (role === "MENTOR") {
    redirect("/mentor-dashboard");
  }
  redirect("/student-dashboard");
}
