import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { sendMessageSchema } from "@/lib/validations/api";
import { createRateLimiter } from "@/lib/rate-limit";

const limiter = createRateLimiter("messages", {
  maxRequests: 30,
  windowSeconds: 60,
});

/**
 * GET /api/messages?conversationWith=<userId>&cursor=<messageId>&limit=<number>
 * Mentor-öğrenci arasındaki mesajları listeler (cursor-based pagination).
 */
export async function GET(req: Request) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const conversationWith = searchParams.get("conversationWith");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 50);

  if (!conversationWith) {
    return NextResponse.json(
      { error: "conversationWith parametresi gerekli." },
      { status: 400 }
    );
  }

  const userId = auth.session.user.id!;

  // Kullanıcının bu kişiyle konuşma yetkisi var mı kontrol et
  const isAllowed = await verifyConversationAccess(userId, conversationWith);
  if (!isAllowed) {
    return NextResponse.json(
      { error: "Bu kişiyle mesajlaşma yetkiniz yok." },
      { status: 403 }
    );
  }

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: conversationWith },
          { senderId: conversationWith, receiverId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: {
          select: { id: true, name: true, lastName: true, role: true },
        },
      },
    });

    const hasMore = messages.length > limit;
    const result = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? result[result.length - 1].id : null;

    // Okunan gelen mesajları okundu olarak işaretle
    await prisma.message.updateMany({
      where: {
        senderId: conversationWith,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({
      messages: result,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json(
      { error: "Mesajlar yüklenirken hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages
 * Yeni mesaj gönder (mentor ↔ öğrenci arası).
 */
export async function POST(req: Request) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;

  const rl = limiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla mesaj gönderdiniz. Lütfen biraz bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { receiverId, content } = parsed.data;

    // Kendine mesaj gönderemez
    if (receiverId === userId) {
      return NextResponse.json(
        { error: "Kendinize mesaj gönderemezsiniz." },
        { status: 400 }
      );
    }

    // Yetki kontrolü: mentor ↔ öğrenci ilişkisi var mı?
    const isAllowed = await verifyConversationAccess(userId, receiverId);
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Bu kişiyle mesajlaşma yetkiniz yok." },
        { status: 403 }
      );
    }

    const message = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId,
        content,
      },
      include: {
        sender: {
          select: { id: true, name: true, lastName: true, role: true },
        },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json(
      { error: "Mesaj gönderilirken hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * Mentor-öğrenci eşleşmesi kontrolü.
 * Sadece birbirine atanmış mentor/öğrenci çiftleri mesajlaşabilir.
 */
async function verifyConversationAccess(
  userId: string,
  otherUserId: string
): Promise<boolean> {
  // userId'nin mentor, otherUserId'nin öğrenci olduğu durum
  const asMentor = await prisma.studentProfile.findFirst({
    where: {
      userId: otherUserId,
      mentorId: userId,
    },
  });
  if (asMentor) return true;

  // userId'nin öğrenci, otherUserId'nin mentor olduğu durum
  const asStudent = await prisma.studentProfile.findFirst({
    where: {
      userId,
      mentorId: otherUserId,
    },
  });
  if (asStudent) return true;

  return false;
}
