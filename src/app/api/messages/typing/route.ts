import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { createRateLimiter } from "@/lib/rate-limit";
import { typingSignalSchema } from "@/lib/validations/api";
import { verifyConversationAccess } from "@/features/messaging/server/erisim";
import { yaziyorIsaretle, yaziyorDurdur } from "@/features/messaging/server/yaziyor";

/**
 * POST /api/messages/typing — "yazıyor..." sinyali (#354).
 *
 * Roller `/api/messages` ile AYNI: mezun (GRADUATED) kullanıcı mesajlaşabildiği
 * için (#208) burada da geçebilmeli, yoksa yazarken göstergesiz kalırdı.
 */

/**
 * İstemci ~3 sn'de bir yeniliyor → dakikada ~20 istek. Sınır bunun üstünde
 * ama açık uçlu değil: kozmetik bir sinyal sınırsız yazma hakkı vermemeli.
 */
const limiter = createRateLimiter("typing", { maxRequests: 40, windowSeconds: 60 });

export async function POST(req: Request) {
  const auth = await requireAuth(["MENTOR", "STUDENT", "ADMIN"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;

  const rl = await limiter.check(userId);
  // Sınıra takılmak SESSİZ: "yazıyor..." kozmetik bir sinyal, kullanıcıya
  // hata göstermek mesajlaşmayı bozulmuş gibi gösterirdi.
  if (!rl.allowed) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  const parsed = typingSignalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { to, yaziyor } = parsed.data;

  // ⚠️ Mesaj gönderemediğiniz kişiye yazdığınızı da bildiremezsiniz.
  // Aksi halde uç, "bu kullanıcı var mı" ve "şu an aktif mi" sorularına
  // yetkisiz yanıt veren bir yan kanala dönüşürdü.
  const izin = await verifyConversationAccess(userId, to, auth.session.user.role);
  if (!izin) {
    return NextResponse.json({ error: "Bu kişiyle mesajlaşma yetkiniz yok." }, { status: 403 });
  }

  try {
    if (yaziyor) await yaziyorIsaretle(userId, to);
    else await yaziyorDurdur(userId, to);
  } catch {
    // Sinyal yazılamazsa özellik çalışmaz ama mesajlaşma bozulmaz.
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({ ok: true });
}
