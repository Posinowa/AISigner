import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ATAMA_SAHIPLIK_SELECT,
  mentoruMu,
} from "@/features/teams/server/sahiplik";
import { requireAuth } from "@/lib/auth/guard";
import { updateStepSchema } from "@/lib/validations/api";
import { yenidenNumaralandir } from "@/features/roadmap/server/siralama";
import { rotaHatasi } from "@/lib/api-hata";

// PUT: Adımı güncelle
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string; stepId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const { roadmapId, stepId } = await params;

    // Mentor ownership kontrolü
    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        // #332: Sahiplik bireysel VEYA takım; tek tanımdan gelir.
        assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
      },
    });

    if (!roadmap) {
      return NextResponse.json({ error: "Yol haritası bulunamadı!" }, { status: 404 });
    }

    if (!mentoruMu(roadmap.assignedProject, auth.session.user.id)) {
      return NextResponse.json(
        { error: "Bu adımı güncelleme yetkiniz yok." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateStepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    // Status alanını mentor tarafından güncellenebilir alanlardan çıkar
    const safeData = { ...parsed.data };
    delete (safeData as { status?: string }).status;

    /*
     * #406: `order` da çıkarılıyor. Tek bir adımın sırasını komşusunu
     * güncellemeden yazmak, iki adımı aynı sırada bırakırdı. Sıra
     * değiştirmenin tek yolu `POST .../steps/reorder` — orası yol
     * haritasının tamamını 1..n yeniden numaralandırıyor.
     */
    delete (safeData as { order?: number }).order;

    /*
     * ⚠️ #411: İŞLEM `roadmapId` İLE DE DARALTILIYOR.
     *
     * Yetki yol haritası üzerinde kuruluyor ama güncelleme adım üzerinde
     * yapılıyor. Öncesi `where: { id: stepId }` idi: mentör kendi yol
     * haritasının kimliğini URL'e koyup BAŞKA bir stajyerin adımının
     * kimliğini vererek o adımın başlığını, açıklamasını, süresini,
     * kaynaklarını ve GitHub issue linkini değiştirebiliyordu.
     *
     * `updateMany` + `count` kullanılıyor: "önce sorgula sonra yaz" değil,
     * tek ifadede (#345/#349/#398 dersi).
     */
    /*
     * Yazılacak alan kalmadıysa (gövde yalnız `status`/`order` içeriyordu)
     * güncelleme HİÇ çağrılmıyor: Prisma boş `data` ile `count: 0` dönüyor ve
     * bu, var olan bir adım için yanıltıcı bir 404 üretirdi. Adımın kendisi
     * yine `roadmapId` ile daraltılarak okunuyor.
     */
    if (Object.keys(safeData).length === 0) {
      const mevcut = await prisma.roadmapStep.findFirst({
        where: { id: stepId, roadmapId },
      });
      if (!mevcut) {
        return NextResponse.json({ error: "Adım bulunamadı." }, { status: 404 });
      }
      return NextResponse.json(mevcut);
    }

    const { count } = await prisma.roadmapStep.updateMany({
      where: { id: stepId, roadmapId },
      data: safeData,
    });

    // Adım bu yol haritasına ait değilse 404: başkasının adımının VAR OLDUĞU
    // bile sızmasın.
    if (count === 0) {
      return NextResponse.json({ error: "Adım bulunamadı." }, { status: 404 });
    }

    const step = await prisma.roadmapStep.findFirst({ where: { id: stepId, roadmapId } });
    return NextResponse.json(step);
  } catch (error) {
    rotaHatasi("Step PUT Error:", error);
    return NextResponse.json(
      { error: "Adım güncellenirken hata oluştu." },
      { status: 500 }
    );
  }
}

// DELETE: Adımı sil
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roadmapId: string; stepId: string }> }
) {
  const auth = await requireAuth("MENTOR");
  if (!auth.authorized) return auth.response;

  try {
    const { roadmapId, stepId } = await params;

    // Mentor ownership kontrolü
    const roadmap = await prisma.roadmap.findUnique({
      where: { id: roadmapId },
      include: {
        // #332: Sahiplik bireysel VEYA takım; tek tanımdan gelir.
        assignedProject: { select: ATAMA_SAHIPLIK_SELECT },
      },
    });

    if (!roadmap) {
      return NextResponse.json({ error: "Yol haritası bulunamadı!" }, { status: 404 });
    }

    if (!mentoruMu(roadmap.assignedProject, auth.session.user.id)) {
      return NextResponse.json(
        { error: "Bu adımı silme yetkiniz yok." },
        { status: 403 }
      );
    }

    // Öğrenci ilerlemesi koruması: aktif/tamamlanmış adımlar ?force=true olmadan silinemez
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    /*
     * ⚠️ #411: ARAMA `roadmapId` İLE DE DARALTILIYOR.
     *
     * Öncesi `where: { id: stepId }` idi. Mentör kendi yol haritasının
     * kimliğiyle BAŞKA bir stajyerin adımını silebiliyordu; üstelik silme
     * sonrası yeniden numaralandırma URL'deki `roadmapId`'ye bakıyordu, yani
     * hasar iki yol haritasına birden dağılıyordu: adım birinden siliniyor,
     * diğeri yeniden numaralanıyordu.
     */
    const step = await prisma.roadmapStep.findFirst({
      where: { id: stepId, roadmapId },
      select: { status: true },
    });

    if (!step) {
      return NextResponse.json({ error: "Adım bulunamadı." }, { status: 404 });
    }

    if (!force && (step.status === "IN_PROGRESS" || step.status === "COMPLETED")) {
      return NextResponse.json(
        {
          error:
            "Bu adımda öğrenci ilerlemesi var. Silmek için onay gerekiyor.",
          requiresConfirmation: true,
          stepStatus: step.status,
        },
        { status: 409 }
      );
    }

    const { count } = await prisma.roadmapStep.deleteMany({
      where: { id: stepId, roadmapId },
    });

    // Araya giren bir silme yarışını kaybettiysek sıraya dokunma.
    if (count === 0) {
      return NextResponse.json({ error: "Adım bulunamadı." }, { status: 404 });
    }

    /*
     * Silme sırada boşluk bırakır; kalan adımlar 1..n yeniden numaralanıyor.
     *
     * ⚠️ Eskiden bu, döngü içinde N ayrı `update` ile yapılıyordu — atomik
     * değildi, yarıda kalırsa sıra bozuk kalırdı. Artık #406'nın tek
     * `$transaction` kullanan ortak yardımcısından geçiyor.
     */
    await yenidenNumaralandir(roadmapId);

    return NextResponse.json({ success: true });
  } catch (error) {
    rotaHatasi("Step DELETE Error:", error);
    return NextResponse.json(
      { error: "Adım silinirken hata oluştu." },
      { status: 500 }
    );
  }
}
