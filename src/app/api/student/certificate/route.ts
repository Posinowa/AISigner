import { rotaHatasi } from "@/lib/api-hata";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import {
  getStudentCertificate,
  ensureCertificateIssued,
} from "@/features/certificate/server/certificate";

export async function GET() {
  const auth = await requireAuth(["STUDENT", "ADMIN", "MENTOR"]);
  if (!auth.authorized) return auth.response;

  const studentUserId = auth.session.user?.id;
  if (!studentUserId) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  try {
    let certificate = await getStudentCertificate(studentUserId);
    if (!certificate) {
      return NextResponse.json(
        { error: "Sertifika verisi bulunamadı." },
        { status: 404 },
      );
    }

    // #208: Öğrenci rolündeyse yalnızca mezun edilmişse veya resmi issuedAt varsa sertifika alabilir.
    if (auth.session.user.role === "STUDENT") {
      const isGraduated = auth.session.user.accountStatus === "GRADUATED";
      const isIssued = certificate.issuedAt !== null;

      if (!isGraduated && !isIssued) {
        return NextResponse.json(
          { error: "Henüz mezun durumunda değilsiniz veya resmi sertifikanız düzenlenmedi." },
          { status: 403 },
        );
      }

      // #208 review: Öğrenciye ASLA kayıtlı olmayan (doğrulanamayan) seri no gösterme.
      // Bu düzeltmeden ÖNCE mezun edilmiş kayıtlarda seri no/issuedAt boş olabilir —
      // burada kendi kendini onarır, böylece QR/verificationUrl gerçekten çalışır.
      if (isGraduated && !certificate.isIssued) {
        await ensureCertificateIssued(studentUserId);
        certificate = (await getStudentCertificate(studentUserId)) ?? certificate;
      }
    }

    return NextResponse.json({ success: true, certificate });
  } catch (error) {
    rotaHatasi("Error loading certificate:", error);
    return NextResponse.json(
      { error: "Sertifika yüklenirken bir hata oluştu." },
      { status: 500 },
    );
  }
}

