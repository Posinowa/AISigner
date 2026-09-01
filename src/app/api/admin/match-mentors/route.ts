import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { matchMentorsSchema } from "@/lib/validations/api";
import {
  mentorOnerisiUret,
  type OneriHatasi,
} from "@/features/matching/server/eslestirme";

/**
 * Mentör önerisi (#328).
 *
 * Bu uç ATAMA YAPMAZ — yalnızca sıralama döndürür. Atama, admin'in mevcut
 * `PATCH /api/admin/users` çağrısıyla ayrı bir adım olarak kalıyor: öneriyi
 * uygulamak bilinçli bir tık olmalı, çağrının yan etkisi değil.
 */

const DURUM: Record<OneriHatasi, number> = {
  "ogrenci-yok": 404,
  "profil-yok": 400,
  "riza-yok": 403,
  "aday-yok": 409,
  "tavan-doldu": 429,
  "ai-hatasi": 502,
};

const MESAJ: Record<OneriHatasi, string> = {
  "ogrenci-yok": "Öğrenci bulunamadı.",
  "profil-yok": "Bu öğrencinin profili henüz tamamlanmamış.",
  "riza-yok":
    "Bu öğrenci yapay zekâ işleme onayı vermediği için öneri üretilemiyor. " +
    "Onayı profilinden verebilir.",
  "aday-yok":
    "Sıralanabilecek mentör yok: mentörlerin AI analizi üretilmemiş ya da " +
    "yapay zekâ onayları yok.",
  "tavan-doldu": "Saatlik öneri sınırına ulaşıldı. Bir süre sonra tekrar deneyin.",
  "ai-hatasi": "Yapay zekâ önerisi üretilemedi.",
};

export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (!auth.authorized) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = matchMentorsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sonuc = await mentorOnerisiUret({
    studentUserId: parsed.data.studentId,
    adminUserId: auth.session.user.id!,
  });

  if (!sonuc.ok) {
    return NextResponse.json(
      { error: MESAJ[sonuc.neden], neden: sonuc.neden },
      { status: DURUM[sonuc.neden] },
    );
  }

  return NextResponse.json(sonuc);
}
