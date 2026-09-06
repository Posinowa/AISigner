import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/nextauth";

type Role = "ADMIN" | "MENTOR" | "STUDENT";

type RequireAuthOptions = {
  /**
   * #143: PENDING (henüz onaylanmamış) stajyerin de bu endpoint'i çağırmasına
   * izin ver. Yalnızca **profil tamamlama** akışındaki uçlar için kullanılır —
   * kullanıcı onaya düşmeden önce profilini doldurabilsin diye.
   * REJECTED her durumda engellenir.
   */
  allowUnapprovedStudent?: boolean;
};

/**
 * API route'larında oturum ve rol kontrolü yapar.
 * Başarısızsa uygun HTTP yanıtı döner; başarılıysa session objesini döner.
 * Tek bir rol veya birden fazla rol (dizi) kabul eder.
 */
export async function requireAuth(
  requiredRole?: Role | Role[],
  options?: RequireAuthOptions,
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { error: "Oturum açılmamış. Lütfen giriş yapın." },
        { status: 401 }
      ),
    };
  }

  /*
   * ⚠️ #391: ROLÜN VARLIĞI ZORUNLU — rol istensin istenmesin.
   *
   * `nextauth.ts` JWT callback'i silinmiş kullanıcıda yetkiyi doğru şekilde
   * kaldırıyor (`token.role = undefined`), ama bu kapı iki yerden birden
   * kaçıyordu:
   *
   *   1. Rol kontrolü `if (requiredRole)` içindeydi — `requireAuth()` rolsüz
   *      çağrıldığında (ör. `/api/suggestions`) blok hiç çalışmıyordu.
   *   2. Durum kapısı `role === "STUDENT" || role === "MENTOR"` ile sınırlı;
   *      `role` undefined olduğu için o da devre dışı kalıyordu.
   *
   * Sonuç: silinen hesabın jetonu, süresi dolana kadar iş görmeye devam
   * ediyordu. #44 tam bu pencereyi kapatmak için kurulmuştu.
   *
   * 401 dönüyoruz, 403 değil: hesap artık YOK — istemci oturumu temizleyip
   * yeniden giriş yapmalı. 403 "giriş yaptın ama yetkin yok" derdi.
   */
  if (!session.user.role) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { error: "Oturumunuz artık geçerli değil. Lütfen yeniden giriş yapın." },
        { status: 401 },
      ),
    };
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowedRoles.includes(session.user.role as Role)) {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { error: "Bu işlem için yetkiniz bulunmuyor." },
          { status: 403 }
        ),
      };
    }
  }

  // Onaylanmamış hesap (PENDING/REJECTED) hiçbir korumalı işlem yapamaz.
  //
  // #249: Kontrol önceden yalnızca STUDENT rolüne uygulanıyordu; onaylanmamış
  // bir MENTOR hesabı mentör uçlarını çağırabiliyordu. ADMIN bilerek kapsam
  // dışı — admin kendi hesabını kilitleyemesin.
  //
  // #143 istisnası: profil tamamlama uçları `allowUnapprovedStudent` ile PENDING'e
  // açılabilir — kullanıcı onaya düşmeden önce profilini doldurabilsin. REJECTED
  // bu istisnadan yararlanamaz.
  // İstisna yalnızca stajyere ait: açılan uçlar profil tamamlama akışı.
  const isPendingButAllowed =
    options?.allowUnapprovedStudent &&
    session.user.role === "STUDENT" &&
    session.user.accountStatus === "PENDING";

  const onayGerektirenRol =
    session.user.role === "STUDENT" || session.user.role === "MENTOR";

  if (
    onayGerektirenRol &&
    session.user.accountStatus &&
    session.user.accountStatus !== "APPROVED" &&
    session.user.accountStatus !== "GRADUATED" &&
    !isPendingButAllowed
  ) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { error: "Hesabınız henüz onaylanmadı." },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true as const,
    session,
  };
}
