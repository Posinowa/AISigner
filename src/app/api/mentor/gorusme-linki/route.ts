import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { gorusmeLinkiSchema } from "@/lib/validations/api";

/**
 * Mentörün görüşme bağlantısı (#398).
 *
 * ⚠️ Otomatik Meet linki ÜRETMİYORUZ. Google Calendar entegrasyonu yeni bir
 * OAuth akışı, token saklama ve mentörün takvimine erişim demekti — yeni bir
 * KVKK aydınlatma yüzeyi. #330'da sesli/görüntülü görüşme aynı gerekçeyle
 * kapatılmıştı.
 *
 * ⚠️ Link mentörün girdiği METİN: yalnız http/https kabul ediliyor
 * (`gorusmeLinkiSchema`), aksi halde stajyerin tıkladığı yerde `javascript:`
 * çalıştırılabilirdi.
 */
export async function POST(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const govde = await req.json().catch(() => null);
  const parsed = gorusmeLinkiSchema.safeParse(govde);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { count } = await prisma.mentorProfile.updateMany({
    // Kapsam OTURUMDAN: profil kimliği istemciden alınmıyor.
    where: { userId: auth.session.user.id! },
    data: { gorusmeLinki: parsed.data.link || null },
  });

  if (count === 0) {
    // Mentör profili yalnız başvuru akışında (#287) oluşuyor; seed veya admin
    // eliyle açılan mentör hesabında henüz yok. Slot açmak yine çalışıyor,
    // yalnız bağlantı kaydedilemiyor — mesaj bunu söylüyor.
    return NextResponse.json(
      { error: "Bağlantıyı kaydetmek için önce mentör profilini tamamla." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, link: parsed.data.link || null });
}

/** Mentörün kayıtlı bağlantısı — panel girdiyi bununla dolduruyor. */
export async function GET() {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const profil = await prisma.mentorProfile.findUnique({
    where: { userId: auth.session.user.id! },
    select: { gorusmeLinki: true },
  });

  return NextResponse.json({ link: profil?.gorusmeLinki ?? null });
}
