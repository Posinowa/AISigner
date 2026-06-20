import { NextResponse } from "next/server";
import { updateAccountStatus } from "@/features/admin/server/user";
import { requireAuth } from "@/lib/auth/guard";
import { updateAccountStatusSchema } from "@/lib/validations/api";

/**
 * POST /api/admin/users/approval
 * Admin: bir stajyer hesabını APPROVED / REJECTED / PENDING yapar.
 * Body: { userId: string, accountStatus: "PENDING" | "APPROVED" | "REJECTED" }
 */
export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const parsed = updateAccountStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Admin kendi hesabının durumunu değiştiremez (yanlışlıkla kendini pasifleştirmesin)
  if (parsed.data.userId === auth.session.user.id) {
    return NextResponse.json(
      { error: "Kendi hesabınızın durumunu değiştiremezsiniz." },
      { status: 403 }
    );
  }

  const updated = await updateAccountStatus(parsed.data.userId, parsed.data.accountStatus);
  return NextResponse.json(updated);
}
