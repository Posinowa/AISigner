import { NextResponse } from "next/server";
import { mezunYazmaKapisi } from "@/lib/auth/mezun-politikasi";
import { requireAuth } from "@/lib/auth/guard";
import { createProposalSchema } from "@/lib/validations/api";
import {
  oneriOlustur,
  ogrencininOnerileri,
  type OneriHatasi,
} from "@/features/proposals/server/oneri";

/**
 * Stajyerin kendi proje önerileri (#366).
 *
 * Öneri ATAMA YAPMAZ; admin onaylayınca atamaya dönüşür.
 */
const DURUM: Partial<Record<OneriHatasi, number>> = {
  "profil-yok": 400,
  "zaten-bekliyor": 409,
  "repo-gerekli": 400,
};

const MESAJ: Partial<Record<OneriHatasi, string>> = {
  "profil-yok": "Önce profilinizi tamamlamalısınız.",
  "zaten-bekliyor": "Zaten değerlendirilmeyi bekleyen bir öneriniz var.",
  "repo-gerekli": "Depo bağlama ve devretme için geçerli bir GitHub adresi gerekli.",
};

export async function GET() {
  const auth = await requireAuth("STUDENT");
  if (!auth.authorized) return auth.response;

  try {
    return NextResponse.json({ oneriler: await ogrencininOnerileri(auth.session.user.id!) });
  } catch (error) {
    console.error("GET /api/student/proposals error:", error);
    return NextResponse.json({ error: "Öneriler yüklenemedi." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth("STUDENT");
  if (!auth.authorized) return auth.response;

  /*
   * #208: Mezun stajyer YENİ öneri açamaz.
   *
   * Öneri onaylanırsa bir `AssignedProject`'e dönüşür — yani sistem durumunu
   * değiştiren bir uç. #208'in ayrımına göre bu kapalı, GET (kendi geçmişini
   * okuma) açık kalıyor.
   */
  const mezunKapisi = mezunYazmaKapisi(auth.session, "Mezun öğrenciler yeni proje önerisi oluşturamaz.");
  if (mezunKapisi) return mezunKapisi;

  const body = await req.json().catch(() => null);
  const parsed = createProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const sonuc = await oneriOlustur({
      studentUserId: auth.session.user.id!,
      ...parsed.data,
    });
    if (!sonuc.ok) {
      return NextResponse.json(
        { error: MESAJ[sonuc.neden] ?? "Öneri oluşturulamadı." },
        { status: DURUM[sonuc.neden] ?? 400 },
      );
    }
    return NextResponse.json(sonuc.veri, { status: 201 });
  } catch (error) {
    console.error("POST /api/student/proposals error:", error);
    return NextResponse.json({ error: "Öneri oluşturulamadı." }, { status: 500 });
  }
}
