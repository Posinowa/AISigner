import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Korumalı route grupları ve gerektirdikleri roller
const protectedRoutes: Record<string, string> = {
  "/admin-dashboard": "ADMIN",
  "/mentor-dashboard": "MENTOR",
  "/student-dashboard": "STUDENT",
  "/student-onboarding": "STUDENT",
  "/profile-setup": "STUDENT",
};

// Auth gerektirmeyen public sayfalar
// NOT: /forgot-password oturumsuz kullanıcılar için erişilebilir olmalı (şifre sıfırlama).
// #171: /terms ve /privacy oturumsuz da okunabilmeli (kayıt ekranı bunlara link verir).
const publicPaths = ["/signin", "/signup", "/forgot-password", "/terms", "/privacy", "/api/auth", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public path'ler — ama oturum açıksa signin/signup'a gitmeye gerek yok
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    // /signin veya /signup'a giden oturum açık kullanıcıyı kendi paneline yönlendir
    if (pathname === "/signin" || pathname === "/signup") {
      const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
      // Yalnız GEÇERLİ rolü olan (canlı) oturumu panele yönlendir. Rolü olmayan token
      // (ör. hesabı SİLİNMİŞ kullanıcı — JWT callback rol'ü undefined yapar) burada
      // yönlendirilmez → signin'de kalır. Aksi halde /signin ↔ /dashboard sonsuz
      // yönlendirme döngüsüne girilir (ERR_TOO_MANY_REDIRECTS).
      const role = token?.role as string | undefined;
      if (role === "ADMIN") return NextResponse.redirect(new URL("/admin-dashboard", request.url));
      if (role === "MENTOR") return NextResponse.redirect(new URL("/mentor-dashboard", request.url));
      if (role === "STUDENT") return NextResponse.redirect(new URL("/student-dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Statik dosyalar ve Next.js internal path'leri atla
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // JWT token'ı kontrol et
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  // Giriş yapmamış kullanıcıları signin'e yönlendir
  if (!token) {
    // Ana sayfa hariç (landing page olabilir)
    if (pathname === "/") {
      return NextResponse.next();
    }

    const signinUrl = new URL("/signin", request.url);
    signinUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signinUrl);
  }

  // Rol bazlı erişim kontrolü
  const userRole = token.role as string | undefined;

  // Onaylanmamış stajyer (PENDING/REJECTED) → durum ekranı. (#38 status, #39 ekran)
  //
  // #143: PENDING kullanıcı profilini TAMAMLAYABİLMELİ — admin boş bir profili
  // değil, dolu profili (+ AI analizini) görerek onaylasın ve mentör atasın.
  // Bu yüzden profil tamamlama rotaları PENDING'e açıktır; yalnızca dashboard
  // kapalıdır. REJECTED ise hiçbirine erişemez.
  const accountStatus = token.accountStatus as string | undefined;
  if (
    userRole === "STUDENT" &&
    accountStatus &&
    accountStatus !== "APPROVED" &&
    accountStatus !== "GRADUATED"
  ) {
    const isProfileCompletionRoute =
      pathname.startsWith("/student-onboarding") || pathname.startsWith("/profile-setup");
    const isStudentArea =
      pathname.startsWith("/student-dashboard") || isProfileCompletionRoute;

    const blocked =
      accountStatus === "REJECTED" ? isStudentArea : isStudentArea && !isProfileCompletionRoute;

    if (blocked) {
      return NextResponse.redirect(new URL("/account-status", request.url));
    }
  }

  for (const [route, requiredRole] of Object.entries(protectedRoutes)) {
    if (pathname.startsWith(route) && userRole !== requiredRole) {
      // Yanlış role sahip kullanıcıyı kendi dashboard'una yönlendir
      if (userRole === "ADMIN") {
        return NextResponse.redirect(new URL("/admin-dashboard", request.url));
      } else if (userRole === "MENTOR") {
        return NextResponse.redirect(
          new URL("/mentor-dashboard", request.url)
        );
      } else if (userRole === "STUDENT") {
        return NextResponse.redirect(
          new URL("/student-dashboard", request.url)
        );
      }

      // Bilinmeyen rol → signin
      return NextResponse.redirect(new URL("/signin", request.url));
    }
  }

  // API route'ları için middleware'den geç (guard.ts zaten koruma sağlıyor)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aşağıdaki path'ler HARİÇ tüm route'larda çalışır:
     * - _next/static (statik dosyalar)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
