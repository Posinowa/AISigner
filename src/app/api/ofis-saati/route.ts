import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { ofisSaatiAcSchema } from "@/lib/validations/api";
import {
  slotlariAc,
  mentorunSlotlari,
  ogrencininGorebilecegiSlotlar,
} from "@/features/ofis-saati/server/ofis-saati";

/**
 * Ofis saati slotları (#398).
 *
 * GET  — role göre farklı görünüm: mentör kendi takvimini, stajyer yalnız
 *        KENDİ mentörlerinin boş slotlarını ve kendi rezervasyonlarını görür.
 * POST — mentör yeni aralık açar.
 */

export async function GET() {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;

  if (auth.session.user.role === "MENTOR") {
    return NextResponse.json({ slotlar: await mentorunSlotlari(userId), rol: "MENTOR" });
  }

  return NextResponse.json({
    slotlar: await ogrencininGorebilecegiSlotlar(userId),
    rol: "STUDENT",
  });
}

const MESAJLAR: Record<string, string> = {
  "gecmis-zaman": "Geçmiş bir zamana slot açılamaz.",
  "gecersiz-aralik": "Aralık en az bir görüşme dilimi kadar olmalı.",
  "cok-uzun": "Tek seferde bu kadar uzun bir aralık açılamaz.",
  "slot-yok": "Slot bulunamadı.",
  dolu: "Bu slot az önce başkası tarafından alındı.",
};

export async function POST(req: Request) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  const govde = await req.json().catch(() => null);
  const parsed = ofisSaatiAcSchema.safeParse(govde);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const sonuc = await slotlariAc({
    mentorUserId: auth.session.user.id!,
    baslangic: new Date(parsed.data.baslangic),
    bitis: new Date(parsed.data.bitis),
  });

  if (!sonuc.ok) {
    return NextResponse.json({ error: MESAJLAR[sonuc.neden] }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...sonuc.veri }, { status: 201 });
}
