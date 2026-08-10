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

  // Onaylanmamış stajyer hesabı (PENDING/REJECTED) hiçbir student işlemi yapamaz.
  // Admin/mentor bu kontrolden etkilenmez (yalnızca STUDENT rolüne uygulanır).
  //
  // #143 istisnası: profil tamamlama uçları `allowUnapprovedStudent` ile PENDING'e
  // açılabilir — kullanıcı onaya düşmeden önce profilini doldurabilsin. REJECTED
  // bu istisnadan yararlanamaz.
  const isPendingButAllowed =
    options?.allowUnapprovedStudent && session.user.accountStatus === "PENDING";

  if (
    session.user.role === "STUDENT" &&
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
