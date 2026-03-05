import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/nextauth";

type Role = "ADMIN" | "MENTOR" | "STUDENT";

/**
 * API route'larında oturum ve rol kontrolü yapar.
 * Başarısızsa uygun HTTP yanıtı döner; başarılıysa session objesini döner.
 * Tek bir rol veya birden fazla rol (dizi) kabul eder.
 */
export async function requireAuth(requiredRole?: Role | Role[]) {
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

  return {
    authorized: true as const,
    session,
  };
}
