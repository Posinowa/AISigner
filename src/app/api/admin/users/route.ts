import { NextResponse } from "next/server";
import {
  getAllUsers,
  kullaniciSayilari,
  updateUserRole,
  setStudentMentors,
  AssignmentValidationError,
} from "@/features/admin/server/user";
import { gecerliKategori } from "@/features/admin/kategoriler";
import { requireAuth } from "@/lib/auth/guard";
import { updateRoleSchema, assignMentorSchema } from "@/lib/validations/api";
import { rotaHatasi } from "@/lib/api-hata";

/**
 * Kullanıcı listesi — sayfalı, sunucuda filtreli/aranan.
 *
 * ⚠️ YANIT ŞEKLİ DEĞİŞTİ: düz dizi yerine `{ users, nextCursor, sayilar }`.
 * `TakimYonetimi` her iki şekli de karşılıyordu (`Array.isArray(veri) ? ...`),
 * panel bu PR'da güncellendi.
 *
 * ⚠️ SAYAÇLAR HER SAYFADA DÖNMÜYOR. İlk istekte (imleçsiz) hesaplanıyor;
 * "daha fazla yükle" isteklerinde `sayilar` YOK. Sayaçlar sayfaya göre
 * değişmiyor, her sayfada üç toplama sorgusu daha koşturmak boşuna yük
 * olurdu.
 */
export async function GET(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");

  const [liste, sayilar] = await Promise.all([
    getAllUsers({
      kategori: gecerliKategori(searchParams.get("kategori")),
      q: searchParams.get("q") ?? "",
      cursor,
      limit: Number(searchParams.get("limit")) || undefined,
    }),
    cursor ? Promise.resolve(null) : kullaniciSayilari(),
  ]);

  return NextResponse.json({ ...liste, ...(sayilar ? { sayilar } : {}) });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Admin kendi rolünü değiştiremez — panel erişimini kaybeder
  if (parsed.data.userId === auth.session.user.id) {
    return NextResponse.json(
      { error: "Kendi rolünüzü değiştiremezsiniz." },
      { status: 403 }
    );
  }

  const updated = await updateUserRole(parsed.data.userId, parsed.data.role);
  return NextResponse.json(updated);
}

export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const parsed = assignMentorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const updated = await setStudentMentors(parsed.data.studentId, parsed.data.mentorIds);
    return NextResponse.json(updated);
  } catch (error) {
    // #43: Geçersiz rol → 400 (anlamlı mesaj). Diğer hatalar → 500.
    if (error instanceof AssignmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    rotaHatasi("POST /api/admin/users assignMentor error:", error);
    return NextResponse.json(
      { error: "Mentor atama sırasında bir hata oluştu." },
      { status: 500 },
    );
  }
}
