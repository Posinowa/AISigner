import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { createRateLimiter } from "@/lib/rate-limit";
import { getVertexAI } from "@/lib/ai/gemini-client";
import { prisma } from "@/lib/db";

const limiter = createRateLimiter("ai-chat", {
  maxRequests: 20,
  windowSeconds: 60,
});

const SYSTEM_PROMPT = `Sen AISigner platformundaki bir yapay zeka eğitim asistanısın. Adın "Posilog"dur.

Görevin:
- Öğrencilere yazılım geliştirme, programlama ve teknoloji konularında yardımcı olmak
- Proje adımlarında takıldıkları noktaları açıklamak
- Kavramları basit ve anlaşılır bir dille Türkçe açıklamak
- Kod örnekleri ile desteklemek
- Motivasyon vermek ve öğrenme sürecini desteklemek

Kurallar:
- Türkçe yanıt ver (teknik terimler hariç)
- Kısa ve öz ol, gereksiz uzatma
- Konu dışı sorularda kibar bir şekilde yönlendir
- Asla zararlı, yanıltıcı veya uygunsuz içerik üretme
- Öğrencinin seviyesine uygun açıklamalar yap`;

/**
 * POST /api/student/ai-chat
 * Öğrenci AI asistanı chat endpoint.
 * Body: { message: string, history?: { role: string, content: string }[] }
 */
export async function POST(req: Request) {
  const auth = await requireAuth("STUDENT");
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
    const { message, history } = body as {
      message: string;
      history?: { role: string; content: string }[];
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Mesaj boş olamaz." },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Mesaj en fazla 2000 karakter olabilir." },
        { status: 400 }
      );
    }

    // Öğrenci bağlamını al (profil, projeler, roadmap)
    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        assignedProjects: {
          include: {
            projectTemplate: { select: { title: true, track: true, difficulty: true } },
            roadmap: {
              include: {
                steps: {
                  orderBy: { order: "asc" },
                  select: { title: true, status: true, order: true },
                },
              },
            },
          },
        },
      },
    });

    // Bağlam oluştur
    let context = "";
    if (profile) {
      context += `\n\nÖğrenci Bilgileri:`;
      context += `\n- Deneyim Seviyesi: ${profile.experienceLevel}`;
      context += `\n- İlgi Alanları: ${profile.interests.join(", ")}`;
      if (profile.goals) context += `\n- Hedefler: ${profile.goals}`;

      if (profile.assignedProjects.length > 0) {
        context += `\n\nAktif Projeler:`;
        profile.assignedProjects.forEach((ap) => {
          context += `\n- ${ap.projectTemplate.title} (${ap.projectTemplate.difficulty}, ${ap.projectTemplate.track.join(", ")})`;
          if (ap.roadmap?.steps) {
            const currentStep = ap.roadmap.steps.find(
              (s) => s.status === "IN_PROGRESS"
            );
            const completedCount = ap.roadmap.steps.filter(
              (s) => s.status === "COMPLETED"
            ).length;
            context += ` - ${completedCount}/${ap.roadmap.steps.length} adım tamamlandı`;
            if (currentStep) {
              context += `, Şu anki adım: "${currentStep.title}"`;
            }
          }
        });
      }
    }

    const vertexAI = getVertexAI();
    const model = vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash-001",
    });

    // Chat geçmişini oluştur (sadece user/assistant rolleri kabul et - prompt injection önleme)
    const safeHistory = (history || [])
      .filter(
        (h): h is { role: string; content: string } =>
          h != null &&
          typeof h.content === "string" &&
          h.content.length > 0 &&
          h.content.length <= 2000 &&
          (h.role === "user" || h.role === "assistant")
      )
      .slice(-10) // Son 10 mesaj
      .map((h) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      }));

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + context }],
        },
        {
          role: "model",
          parts: [
            {
              text: "Anladım! Ben Posilog. Yazılım ve teknoloji konularında sorularınıza yardımcı olmaya hazırım. Nasıl yardımcı olabilirim?",
            },
          ],
        },
        ...safeHistory,
      ],
    });

    const result = await chat.sendMessage(message.trim());
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "Üzgünüm, bir cevap üretemiyorum. Lütfen tekrar deneyin.";

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error("POST /api/student/ai-chat error:", error);
    return NextResponse.json(
      { error: "AI yanıt üretirken hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
