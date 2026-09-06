import { NextResponse } from "next/server";
import { deleteUser, AssignmentValidationError } from "@/features/admin/server/user";
import { requireAuth } from "@/lib/auth/guard";
import { rotaHatasi } from "@/lib/api-hata";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { userId } = await params;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Geçersiz kullanıcı ID." }, { status: 400 });
  }

  const currentAdminId = auth.session.user?.id;
  if (!currentAdminId) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  try {
    const deleted = await deleteUser(userId, currentAdminId);
    return NextResponse.json({
      success: true,
      message: "Kullanıcı ve ilişkili verileri başarıyla silindi.",
      user: deleted,
    });
  } catch (error) {
    if (error instanceof AssignmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    rotaHatasi("DELETE /api/admin/users/[userId] error:", error);
    return NextResponse.json(
      { error: "Kullanıcı silinirken bir hata oluştu." },
      { status: 500 },
    );
  }
}
