import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ATAMA_SAHIPLIK_SELECT,
  erisebilirMi,
  mentoruMu,
  ogrencisiMi,
} from "@/features/teams/server/sahiplik";
import { requireAuth } from "@/lib/auth/guard";
import { updateStepStatusSchema } from "@/lib/validations/api";
import { adimDurumunuDegistir } from "@/features/roadmap/server/step-status";

/**
 * PATCH /api/student/steps/[stepId]
 * Öğrencinin kendi roadmap adımının durumunu güncellemesini sağlar.
 * Sadece kendi projesine ait adımları güncelleyebilir.
 * Sıralama kuralı: Bir adımı başlatmak için önceki adımın tamamlanmış olması gerekir.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const auth = await requireAuth("STUDENT");
  if (!auth.authorized) return auth.response;

  // #208: Mezun stajyerler için portfolyo salt-okunurdur (Seçenek A).
  if (auth.session.user.accountStatus === "GRADUATED") {
    return NextResponse.json(
      { error: "Mezun öğrenciler tamamlanan staj adımlarının durumunu değiştiremez." },
      { status: 403 }
    );
  }

  const { stepId } = await params;

  try {
    const body = await req.json();
    const parsed = updateStepStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status: newStatus } = parsed.data;

    // Adımı, ilgili roadmap, proje ve öğrenci profili ile birlikte getir
    const step = await prisma.roadmapStep.findUnique({
      where: { id: stepId },
      include: {
        roadmap: {
          include: {
            // #332: Sahiplik bireysel VEYA takım; tek tanımdan gelir.
            assignedProject: {
              select: { id: true, status: true, ...ATAMA_SAHIPLIK_SELECT },
            },
            steps: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!step) {
      return NextResponse.json({ error: "Adım bulunamadı." }, { status: 404 });
    }

    // Bu adım bu öğrenciye mi ait?
    // #332: Öğrenci = bireysel sahip ya da AKTİF takım üyesi.
    if (!ogrencisiMi(step.roadmap.assignedProject, auth.session.user.id)) {
      return NextResponse.json(
        { error: "Bu adım size ait değil." },
        { status: 403 }
      );
    }

    // Roadmap yayınlanmış mı?
    if (step.roadmap.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Bu yol haritası henüz yayınlanmamış." },
        { status: 400 }
      );
    }

    // Sıralama kontrolü: Önceki adım tamamlanmış olmalı (ilk adım hariç)
    const allSteps = step.roadmap.steps;
    const currentIndex = allSteps.findIndex((s) => s.id === stepId);

    if (currentIndex > 0) {
      const previousStep = allSteps[currentIndex - 1];
      if (previousStep.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Önceki adımı tamamlamadan bu adıma geçemezsiniz." },
          { status: 400 }
        );
      }
    }

    // Geçersiz geçişleri engelle
    if (step.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Tamamlanan bir adımın durumu değiştirilemez." },
        { status: 400 }
      );
    }

    if (step.status === "TODO" && newStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "Bir adımı doğrudan tamamlayamazsınız. Önce başlatın." },
        { status: 400 }
      );
    }

    // Durumu güncelle + geçişi GEÇMİŞE yaz (#324).
    //
    // Doğrudan `prisma.roadmapStep.update` ÇAĞIRMAYIN: geçmişi sessizce atlar
    // ve analitik verisi kalıcı olarak eksilir. İkisi tek transaction'da.
    const updated = await adimDurumunuDegistir({
      stepId,
      yeniDurum: newStatus,
      oncekiDurum: step.status,
      degistirenId: auth.session.user.id ?? null,
    });

    // Tüm adımlar tamamlandıysa proje durumunu da güncelle
    if (newStatus === "COMPLETED") {
      const freshSteps = await prisma.roadmapStep.findMany({
        where: { roadmapId: step.roadmapId },
      });
      const allDone = freshSteps.every((s) => s.status === "COMPLETED");

      if (allDone) {
        await prisma.assignedProject.update({
          where: { id: step.roadmap.assignedProjectId },
          data: { status: "COMPLETED" },
        });
      } else {
        // En az bir adım devam ediyorsa proje IN_PROGRESS olmalı
        await prisma.assignedProject.update({
          where: { id: step.roadmap.assignedProjectId },
          data: { status: "IN_PROGRESS" },
        });
      }
    } else if (newStatus === "IN_PROGRESS") {
      // Proje henüz PENDING ise IN_PROGRESS'e çek
      const project = step.roadmap.assignedProject;
      if (project.status === "PENDING") {
        await prisma.assignedProject.update({
          where: { id: project.id },
          data: { status: "IN_PROGRESS" },
        });
      }
    }

    return NextResponse.json({ step: updated });
  } catch (error) {
    console.error("PATCH /api/student/steps/[stepId] error:", error);
    return NextResponse.json(
      { error: "Adım durumu güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
