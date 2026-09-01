import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { sendMessageSchema, getMessagesSchema } from "@/lib/validations/api";
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
  const auth = await requireAuth(["MENTOR", "STUDENT", "ADMIN"]);
  if (!auth.authorized) return auth.response;

  // #158: Parametreler elle ayrıştırılıyordu; "abc" → NaN, "-5" → negatif
  // `take` olarak Prisma'ya geçip 500'e ve ters yönde sayfalamaya yol açıyordu.
  // Bunun için zaten tanımlı olan (ama kullanılmayan) şema devreye alındı.
  const { searchParams } = new URL(req.url);
  const parsedQuery = getMessagesSchema.safeParse({
    conversationWith: searchParams.get("conversationWith") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: parsedQuery.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { conversationWith, cursor, limit } = parsedQuery.data;

  const userId = auth.session.user.id!;
  const userRole = auth.session.user.role;

  // Kullanıcının bu kişiyle konuşma yetkisi var mı kontrol et
  const isAllowed = await verifyConversationAccess(userId, conversationWith, userRole);
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
  const auth = await requireAuth(["MENTOR", "STUDENT", "ADMIN"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;
  const userRole = auth.session.user.role;

  const rl = await limiter.check(userId);
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

    // Yetki kontrolü: mentor ↔ öğrenci ilişkisi (veya ADMIN)
    const isAllowed = await verifyConversationAccess(userId, receiverId, userRole);
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
 * Konuşma erişim kontrolü.
 * - ADMIN: herkesle mesajlaşabilir (sadece otherUserId var olmalı).
 * - MENTOR/STUDENT: sadece birbirine atanmış mentor/öğrenci çiftleri mesajlaşabilir.
 */
async function verifyConversationAccess(
  userId: string,
  otherUserId: string,
  userRole?: string
): Promise<boolean> {
  if (userRole === "ADMIN") {
    const exists = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    });
    return !!exists;
  }

  // Karşı taraf ADMIN ise (admin → user mesajına yanıt) izin ver
  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { role: true },
  });
  if (other?.role === "ADMIN") return true;

  // #195: M:N — karşı taraf, benim (mentör) öğrencilerimden biri mi?
  const asMentor = await prisma.studentProfile.findFirst({
    where: { userId: otherUserId, mentorAssignments: { some: { mentorId: userId } } },
  });
  if (asMentor) return true;

  // #195: M:N — karşı taraf, benim (öğrenci) mentorlarımdan biri mi?
  const asStudent = await prisma.studentProfile.findFirst({
    where: { userId, mentorAssignments: { some: { mentorId: otherUserId } } },
  });
  if (asStudent) return true;

  return false;
}
