import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";

// Uygulamanın giriş noktası: yönlendirme kararı tek yerde (sunucuda) toplanır.
// Signin başarılı olunca "/"'a hard navigation yapar; buradaki server session
// kontrolü role göre doğru panele yönlendirir (client getSession retry'ına gerek yok).
export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
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
