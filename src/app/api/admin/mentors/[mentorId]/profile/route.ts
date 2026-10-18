import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { rotaHatasi } from "@/lib/api-hata";
import { kullaniciRolVeRizasi, mentorBasvuruProfiliniGetir } from "@/features/mentors/server/gorusme-ve-basvuru";

/**
 * GET /api/admin/mentors/[mentorId]/profile
 *
 * #287: Admin'in bir mentörün BAŞVURU CEVAPLARINI görmesi için.
 *
 * Lazy çekiliyor (stajyerdeki `profile-analysis` ucuyla aynı desen): admin
 * panelinde onlarca mentör listeleniyor, hepsinin serbest metin cevaplarını
 * baştan yüklemenin anlamı yok.
 *
 * #288: Yanıt AI analizini de taşıyor. Ayrı bir uç açılmadı: admin bu ikisini
 * her zaman BİRLİKTE istiyor (cevapları oku, değerlendirmeyi gör) ve ikinci
 * bir istek gereksiz gecikme olurdu.
 *
 * Cevap vermemiş mentör bir HATA değil — 200 + `profile: null` döner ki
 * arayüz "henüz doldurmadı" diyebilsin. 404 dönseydi arayüz bunu gerçek bir
 * arızadan ayırt edemezdi.
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ mentorId: string }> },
) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  try {
    const { mentorId } = await params;

    // #352: Rıza durumu da geliyor. Analizin YOKLUĞUNUN iki farklı sebebi
    // var — "henüz üretilmedi" ve "mentör AI onayı vermedi" — ve admin
    // bunları ayırt edemezse boş kartı arıza sanar.
    const kullanici = await kullaniciRolVeRizasi(mentorId);

    if (!kullanici) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    }
    if (kullanici.role !== "MENTOR") {
      // Stajyerin mentör başvurusu olmaz; sessizce boş dönmek yerine söylüyoruz.
      return NextResponse.json(
        { error: "Bu kullanıcı mentör değil." },
        { status: 400 },
      );
    }

    const profile = await mentorBasvuruProfiliniGetir(mentorId);

    return NextResponse.json({
      profile,
      aiRizasiVar: Boolean(kullanici.aiConsentAt),
    });
  } catch (error) {
    rotaHatasi("GET /api/admin/mentors/[mentorId]/profile error:", error);
    return NextResponse.json(
      { error: "Başvuru yüklenirken hata oluştu." },
      { status: 500 },
    );
  }
}
