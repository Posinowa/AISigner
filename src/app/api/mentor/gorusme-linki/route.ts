import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { gorusmeLinkiSchema } from "@/lib/validations/api";
import { gorusmeLinkiniGetir, gorusmeLinkiniYaz } from "@/features/mentors/server/gorusme-ve-basvuru";

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

  // Kapsam OTURUMDAN: profil kimliği istemciden alınmıyor.
  const count = await gorusmeLinkiniYaz(auth.session.user.id!, parsed.data.link || null);

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

  const link = await gorusmeLinkiniGetir(auth.session.user.id!);

  return NextResponse.json({ link });
}
