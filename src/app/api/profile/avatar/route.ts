import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { createRateLimiter } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { saveAvatar, deleteAvatar } from "@/lib/storage/avatars";
import {
  resimTipiniBelirle,
  tipeGoreUzanti,
  DESTEKLENEN_UZANTILAR,
} from "@/lib/images";

/**
 * #265: Kullanıcının kendi profil fotoğrafı.
 *
 * POST → yükle/değiştir, DELETE → kaldır.
 *
 * Kullanıcı YALNIZCA kendi fotoğrafını yönetir; hedef kullanıcı gövdeden
 * alınmıyor, oturumdan geliyor. Böylece başkasının fotoğrafını değiştirmek
 * mümkün değil.
 *
 * Dosyanın gerçekten resim olduğu İÇERİĞİNDEN doğrulanıyor (`@/lib/images`);
 * uzantıya ve istemcinin bildirdiği MIME tipine güvenilmiyor.
 */

const MAKS_BOYUT = 5 * 1024 * 1024; // 5 MB

const limiter = createRateLimiter("avatar-upload", {
  maxRequests: 10,
  windowSeconds: 600,
});

export async function POST(req: Request) {
  // PENDING stajyer de profilini tamamlarken fotoğraf yükleyebilmeli (#143).
  const auth = await requireAuth(undefined, { allowUnapprovedStudent: true });
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "Oturum geçersiz." }, { status: 401 });
  }

  const rl = await limiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla yükleme denemesi. Lütfen biraz bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let dosya: File | null = null;
  try {
    const form = await req.formData();
    const alan = form.get("file");
    if (alan instanceof File) dosya = alan;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  if (!dosya) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }

  if (dosya.size === 0) {
    return NextResponse.json({ error: "Dosya boş." }, { status: 400 });
  }

  if (dosya.size > MAKS_BOYUT) {
    return NextResponse.json(
      { error: "Dosya çok büyük. En fazla 5 MB olabilir." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await dosya.arrayBuffer());

  // Tek gerçek kaynak: dosyanın kendi imza baytları.
  const tip = resimTipiniBelirle(buffer);
  if (!tip) {
    return NextResponse.json(
      {
        error: `Bu dosya bir resim değil. Desteklenen biçimler: ${DESTEKLENEN_UZANTILAR.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const storedName = `${crypto.randomUUID()}.${tipeGoreUzanti(tip)}`;

  try {
    await saveAvatar(storedName, buffer, tip);
  } catch (error) {
    logger.error("Profil fotoğrafı kaydedilemedi", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Fotoğraf kaydedilemedi. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }

  const onceki = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarFile: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { avatarFile: storedName },
  });

  // Eski dosyayı DB güncellendikten SONRA sil: silme başarısız olursa
  // kullanıcı fotoğrafsız kalmasın, yalnızca artık dosya kalsın.
  if (onceki?.avatarFile) {
    try {
      await deleteAvatar(onceki.avatarFile);
    } catch (error) {
      logger.warn("Eski profil fotoğrafı silinemedi", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const auth = await requireAuth(undefined, { allowUnapprovedStudent: true });
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "Oturum geçersiz." }, { status: 401 });
  }

  const mevcut = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarFile: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { avatarFile: null },
  });

  if (mevcut?.avatarFile) {
    try {
      await deleteAvatar(mevcut.avatarFile);
    } catch (error) {
      logger.warn("Profil fotoğrafı dosyası silinemedi", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
