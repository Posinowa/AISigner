import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { assignProjectToStudent } from "@/features/mentors/server/actions"; 

export async function POST(req: Request) {
  try {
    // 1. Oturum ve Yetki Kontrolü
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "MENTOR" || !session.user.id) {
      return NextResponse.json({ error: "Yetkisiz işlem" }, { status: 401 });
    }

    // 2. Body'den verileri al
    const body = await req.json();
    const { studentProfileId, projectTemplateId } = body;

    if (!studentProfileId || !projectTemplateId) {
      return NextResponse.json(
        { error: "Eksik veri: Öğrenci veya Proje seçilmedi." },
        { status: 400 }
      );
    }

    // 3. Server action ile projeyi veritabanına kaydet
    const result = await assignProjectToStudent(
      studentProfileId,
      projectTemplateId,
      session.user.id
    );

    return NextResponse.json(result, { status: 201 });

  } catch (error: any) {
    console.error("Proje atama hatası:", error);
    return NextResponse.json(
      { error: error.message || "Proje atanırken bir hata oluştu" },
      { status: 500 }
    );
  }
}