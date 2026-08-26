import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { readAvatar } from "@/lib/storage/avatars";
import { resimTipiniBelirle } from "@/lib/images";

/**
 * #265: Profil fotoğrafını servis eder.
 *
 * Signed URL değil PROXY: dosya route üzerinden akıtılıyor, böylece her
 * istekte oturum kontrolü çalışıyor (adım dosyalarındaki #197 kararıyla aynı).
 *
 * Oturum açmış her kullanıcı diğerlerinin fotoğrafını görebilir — admin
 * başvuruyu değerlendirirken, mentör öğrencisini tanırken gerekiyor. Fotoğraf
 * kimliğin bir parçası, gizli bir veri değil; ama oturumsuz erişime de
 * açılmıyor.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAuth(undefined, { allowUnapprovedStudent: true });
  if (!auth.authorized) return auth.response;

  const { userId } = await params;

  const kullanici = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarFile: true },
  });

  if (!kullanici?.avatarFile) {
    return NextResponse.json({ error: "Fotoğraf yok." }, { status: 404 });
  }

  const buffer = await readAvatar(kullanici.avatarFile);
  if (!buffer) {
    // DB'de kayıt var ama dosya yok — veri tutarsızlığı, 404 doğru yanıt.
    return NextResponse.json({ error: "Fotoğraf bulunamadı." }, { status: 404 });
  }

  // İçerik tipi DEPODAN OKUNAN veriden yeniden belirleniyor; DB'deki ada veya
  // yükleme anındaki bilgiye güvenilmiyor.
  const tip = resimTipiniBelirle(buffer);
  if (!tip) {
    return NextResponse.json({ error: "Fotoğraf okunamadı." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": tip,
      // Tarayıcı içerik tipini TAHMİN ETMESİN — nosniff olmadan resim gibi
      // servis edilen bir dosya başka bir şey olarak yorumlanabilir.
      "X-Content-Type-Options": "nosniff",
      // Fotoğraf değişince ad da değişiyor (UUID), bu yüzden uzun önbellek
      // güvenli. private: paylaşımlı önbelleklerde tutulmasın.
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
    },
  });
}
