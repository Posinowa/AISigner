import { NextResponse } from "next/server";
import {prisma} from "@/lib/db"; 
import { recommendProjects } from "@/features/ai/server/project-recommendations";

export async function POST(req: Request) {
  try {
    // 1. Frontend'den gelen isteği (body) alıyoruz
    const body = await req.json();
    const { studentProfileId } = body;

    if (!studentProfileId) {
      return NextResponse.json(
        { error: "Öğrenci Profil ID'si gerekli!" }, 
        { status: 400 }
      );
    }

    // 2. Öğrencinin profilini veritabanından çekiyoruz
    // Not: Şemana göre burada 'id' yerine 'userId' kullanman gerekebilir
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId }, 
    });

    if (!studentProfile) {
      return NextResponse.json(
        { error: "Öğrenci profili bulunamadı!" }, 
        { status: 404 }
      );
    }

    // 3. Sistemdeki tüm müsait proje şablonlarını çekiyoruz
    const availableProjects = await prisma.projectTemplate.findMany();

    if (!availableProjects || availableProjects.length === 0) {
      return NextResponse.json(
        { error: "Sistemde değerlendirilecek proje şablonu bulunmuyor." }, 
        { status: 404 }
      );
    }

    // 4. Hazırladığımız AI servisine verileri gönderip tavsiyeleri alıyoruz
    const recommendations = await recommendProjects(studentProfile, availableProjects);

    // 5. Sonuçları frontend'e JSON olarak başarıyla dönüyoruz
    return NextResponse.json({ recommendations }, { status: 200 });

  } catch (error) {
    console.error("AI Öneri API Hatası:", error);
    return NextResponse.json(
      { error: "Projeler analiz edilirken sunucu tarafında bir hata oluştu." }, 
      { status: 500 }
    );
  }
}