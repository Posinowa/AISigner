import { NextResponse } from "next/server";
import { mezunYazmaKapisi } from "@/lib/auth/mezun-politikasi";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { claimStepSchema } from "@/lib/validations/api";
import {
  ATAMA_SAHIPLIK_SELECT,
  erisebilirMi,
  ogrencisiMi,
} from "@/features/teams/server/sahiplik";
import { adimiUstlen } from "@/features/teams/server/takim";

/**
 * Adımı üstlenme / bırakma (#332 Faz 2).
 *
 * Adım TAKIMIN; bu uç yalnızca "kim çekti" bilgisini yazıyor. Sprint panosunda
 * iş havuzda durur ve biri üzerine alır — bu yüzden BAŞKASININ üstlendiği adım
 * da devralınabiliyor. Kilitlemek pull modelini bozardı; kimin gerçekten
 * tamamladığı zaten `StepStatusHistory.changedById`'de (#324).
 *
 * ⚠️ ÜSTLENİLEN KİŞİ, ATAMANIN ÖĞRENCİSİ OLMAK ZORUNDA. Aksi halde bir mentör
 * (ya da başka bir takımın üyesi) panoya kendini yazabilirdi.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ stepId: string }> }) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId } = await params;
  const userId = auth.session.user.id!;

  const body = await req.json().catch(() => null);
  const parsed = claimStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const step = await prisma.roadmapStep.findUnique({
    where: { id: stepId },
    select: {
      id: true,
      roadmap: {
        select: {
          status: true,
          assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
        },
      },
    },
  });

  // Yetkisiz için 404: adımın varlığını da sızdırmıyoruz (mevcut uçlarla aynı).
  if (!step || !erisebilirMi(step.roadmap.assignedProject, userId)) {
    return NextResponse.json({ error: "Adım bulunamadı." }, { status: 404 });
  }

  /*
   * #208: Mezun stajyerin portfolyosu SALT OKUNUR.
   *
   * Adım üstlenmek panonun durumunu değiştirir; #208'in ayrım ilkesine göre
   * (sistem durumunu değiştiren uçlar kapalı, insan iletişimi açık) bu uç
   * kapalı olmalıydı — adım/dosya/yorum uçlarında kontrol vardı, burada
   * eksik kalmıştı. Mezun bir stajyer eski takımının havuzundan iş çekebiliyordu.
   */
  const mezunKapisi = mezunYazmaKapisi(auth.session, "Mezun öğrenciler adım üstlenemez.");
  if (mezunKapisi) return mezunKapisi;

  // #52 ile aynı kural: taslak yol haritasında öğrenci etkileşimi yok.
  if (ogrencisiMi(step.roadmap.assignedProject, userId) && step.roadmap.status !== "PUBLISHED") {
    return NextResponse.json(
      { error: "Bu yol haritası henüz yayınlanmadı." },
      { status: 403 },
    );
  }

  const hedef = parsed.data.assigneeId;
  if (hedef && !ogrencisiMi(step.roadmap.assignedProject, hedef)) {
    return NextResponse.json(
      { error: "Adım yalnızca bu projenin öğrencilerine atanabilir." },
      { status: 400 },
    );
  }

  const sonuc = await adimiUstlen({ stepId, userId: hedef });
  if (!sonuc.ok) {
    return NextResponse.json({ error: "Adım güncellenemedi." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, assigneeId: hedef });
}
