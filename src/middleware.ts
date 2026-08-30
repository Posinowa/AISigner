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
  // #287: Mentör başvurusunun soruları.
  "/mentor-profile-setup": "MENTOR",
};

// Auth gerektirmeyen public sayfalar
// NOT: /forgot-password oturumsuz kullanıcılar için erişilebilir olmalı (şifre sıfırlama).
// #171: /terms ve /privacy oturumsuz da okunabilmeli (kayıt ekranı bunlara link verir).
// #208: /verify-certificate kamuya açık sertifika doğrulama sayfasıdır.
const publicPaths = [
  "/signin",
  "/signup",
  "/forgot-password",
  // #262: E-postadaki sifirlama baglantisi oturumsuz tiklanir.
  "/reset-password",
  "/terms",
  "/privacy",
  "/verify-certificate",
  "/api/auth",
  "/api/health",
];

/**
 * Middleware'in atlayacağı statik varlık uzantıları (#318).
 *
 * Bilerek DAR tutuldu: liste dışında kalan bir yol middleware'den geçer, yani
 * en kötü ihtimalle gereksiz bir kontrol çalışır. Tersi — geniş bir kural —
 * yetki kapısının atlanması demekti.
 */
const STATIK_UZANTI =
  /\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|map|txt|xml|json|webmanifest|woff|woff2|ttf|otf|eot|mp4|webm|pdf)$/i;

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

  // Statik dosyalar ve Next.js internal path'leri atla.
  //
  // #318: Koşul önceden `pathname.includes(".")` idi — yani yolunda NOKTA olan
  // her istek middleware'i atlıyordu.
  //
  // Sayfa erişimi açısından felaket değildi: `(admin)`/`(mentor)`/`(student)`
  // layout'ları `getServerSession` + rol kontrolü yapıp redirect ediyor, API
  // uçları `requireAuth` kullanıyor. Yani `/admin-dashboard.json` ile panele
  // girilemiyordu.
  //
  // AMA layout'lar rolü kontrol ediyor, `accountStatus`'ü ETMİYOR. O kapı
  // yalnız burada (#249). Noktalı bir dinamik yol — ör.
  // `/mentor-dashboard/abc.def` — onaysız bir MENTOR'ün mentör alanına
  // girmesine izin veriyordu.
  //
  // Artık yalnızca bilinen statik uzantılar atlanıyor. Yeni bir varlık tipi
  // eklenirse listeye de eklenmeli; sessizce yetki atlatmaktansa fazladan
  // middleware çalıştırmak tercih edilir.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    STATIK_UZANTI.test(pathname)
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
  //
  // #249: Kapı ROLDEN BAĞIMSIZ. Önceden koşulun tamamı `userRole === "STUDENT"`
  // içindeydi; onaylanmamış bir MENTOR hesabı mentör paneline girebiliyordu.
  // ADMIN bilerek kapsam dışı — admin kendi hesabını kilitleyemesin.
  const accountStatus = token.accountStatus as string | undefined;
  const onayGerektirenRol = userRole === "STUDENT" || userRole === "MENTOR";

  if (
    onayGerektirenRol &&
    accountStatus &&
    accountStatus !== "APPROVED" &&
    accountStatus !== "GRADUATED"
  ) {
    const isProfileCompletionRoute =
      pathname.startsWith("/student-onboarding") || pathname.startsWith("/profile-setup");
    const isStudentArea =
      pathname.startsWith("/student-dashboard") || isProfileCompletionRoute;
    const isMentorArea = pathname.startsWith("/mentor-dashboard");
    // #287: Mentörün de profil tamamlama yolu var artık. Başvuru soruları
    // tam da hesap PENDING iken doldurulur — onay bu adımdan SONRA gelir.
    // Mentör alanının GERİ KALANI onaysız erişime hâlâ kapalı.
    const isMentorProfileCompletionRoute = pathname.startsWith("/mentor-profile-setup");

    const blocked =
      userRole === "MENTOR"
        ? accountStatus === "REJECTED"
          ? isMentorArea || isMentorProfileCompletionRoute
          : isMentorArea
        : accountStatus === "REJECTED"
          ? isStudentArea
          : isStudentArea && !isProfileCompletionRoute;

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
