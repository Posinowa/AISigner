import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { createRateLimiter } from "@/lib/rate-limit";
import { getTextModel } from "@/lib/ai/gemini-client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";
import { experienceLevelLabel } from "@/lib/experience-level";

const limiter = createRateLimiter("ai-chat", {
  maxRequests: 20,
  windowSeconds: 60,
});

const SYSTEM_PROMPT = `Sen AISigner platformundaki bir yapay zeka öğrenme rehberisin. Adın "Posilog"dur.

Rolün REHBERLİK etmek — öğrencinin YERİNE işi YAPMAMAK. Amacın, öğrencinin kendi başına ilerlemeyi öğrenmesidir.

Görevin:
- Öğrenciyi yönlendir: nereden başlayacağını, hangi roadmap adımına / issue'ya odaklanacağını, nasıl plan yapacağını ve nasıl branch açıp ilerleyeceğini anlat.
- Takıldığı noktada problemi küçük adımlara böl, doğru soruları sormasına yardım et, ilgili kavramı veya kaynağı işaret et.
- Gerektiğinde KISA, açıklayıcı kod parçacıkları (snippet) ver — ama tam çözümü/ödevi baştan sona yazma.
- Motivasyon ver, öğrenme sürecini destekle.

Kurallar:
- Öğrencinin yerine tam çözüm, komple dosya veya uzun hazır kod ÜRETME. Bunun yerine yaklaşımı, adımları ve ipuçlarını ver.
- Öğrenci "kodu sen yaz / ödevi çöz" derse kibarca yönlendir: "Hadi birlikte adım adım ilerleyelim" de ve ilk adımı sor.
- Mümkünse öğrencinin aktif projesi, roadmap adımı ve hedeflerini kullanarak somut yönlendir.
- Türkçe yanıt ver (teknik terimler hariç), kısa ve öz ol.
- Konu dışı sorularda kibarca öğrenme hedefine yönlendir.
- Asla zararlı, yanıltıcı veya uygunsuz içerik üretme.`;

/**
 * POST /api/student/ai-chat
 * Öğrenci AI asistanı chat endpoint.
 * Body: { message: string, history?: { role: string, content: string }[] }
 */
export async function POST(req: Request) {
  const auth = await requireAuth("STUDENT");
  if (!auth.authorized) return auth.response;

  // #208 review (bilinçli karar): Mezun portfolyosu SALT-OKUNUR olduğu için AI chat
  // mezunlara kapalıdır. Gerekçe: her mesaj bir Gemini çağrısı (maliyet) ve chat aktif
  // staj sürecine bağlı bir öğrenme aracı. Mezun geçmiş sohbetlerini görmeye devam eder.
  // (Öneri/istek uçları bilinçli olarak AÇIK bırakıldı — bkz. CLAUDE.md #208.)
  if (auth.session.user.accountStatus === "GRADUATED") {
    return NextResponse.json(
      { error: "Staj süreciniz tamamlandığı için AI asistanı kullanıma kapalıdır." },
      { status: 403 },
    );
  }

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
      context += `\n- Deneyim Seviyesi: ${experienceLevelLabel(profile.experienceLevel)}`;
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

    // #71: AI çağrısı denemesini say — fallback oranı (fallback/attempt) izlenebilsin.
    incrementCounter("ai_chat.attempt");
    const model = getTextModel();

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
              text: "Selam! Ben Posilog 👋 Senin yerine ödevini yapmam ama nereden başlayacağını, hangi adıma odaklanacağını ve nasıl ilerleyeceğini birlikte planlarız. Hangi konuda takıldın?",
            },
          ],
        },
        ...safeHistory,
      ],
    });

    const result = await chat.sendMessage(message.trim());
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "Bunu tam çözemedim. Sorunu biraz daha somutlaştırır mısın — hangi adımda, tam olarak nerede takıldın?";

    return NextResponse.json({ reply: text });
  } catch (error) {
    // #71: Fallback'i say ve logla — fallback oranı yükselirse AI servisi izlenebilsin.
    incrementCounter("ai_chat.fallback");
    logger.error("ai-chat fallback served (AI çağrısı başarısız)", error);
    // #51: AI servisine ulaşılamazsa hata ekranı yerine dostça bir rehber fallback döndür.
    return NextResponse.json({
      reply:
        "Şu an sana bağlanırken bir aksaklık oldu 🙏 Bu sırada şöyle ilerleyebilirsin: roadmap'inde şu anki adıma odaklan, takıldığın yeri küçük parçalara böl ve adımdaki kaynakları incele. Birazdan tekrar yazarsan kaldığımız yerden devam ederiz.",
    });
  }
}
