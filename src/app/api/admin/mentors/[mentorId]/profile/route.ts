import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/**
 * GET /api/admin/mentors/[mentorId]/profile
 *
 * #287: Admin'in bir mentörün BAŞVURU CEVAPLARINI görmesi için.
 *
 * Lazy çekiliyor (stajyerdeki `profile-analysis` ucuyla aynı desen): admin
 * panelinde onlarca mentör listeleniyor, hepsinin serbest metin cevaplarını
 * baştan yüklemenin anlamı yok.
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

    const kullanici = await prisma.user.findUnique({
      where: { id: mentorId },
      select: { role: true },
    });

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

    const profile = await prisma.mentorProfile.findUnique({
      where: { userId: mentorId },
      select: {
        title: true,
        company: true,
        yearsExperience: true,
        seniority: true,
        expertise: true,
        capacity: true,
        weeklyHours: true,
        motivation: true,
        mentoringStyle: true,
        githubUrl: true,
        linkedinUrl: true,
        city: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("GET /api/admin/mentors/[mentorId]/profile error:", error);
    return NextResponse.json(
      { error: "Başvuru yüklenirken hata oluştu." },
      { status: 500 },
    );
  }
}
