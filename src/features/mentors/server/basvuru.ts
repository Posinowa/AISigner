"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/nextauth";
import { prisma } from "@/lib/db";
import { mentorBasvuruSchema } from "../models/basvuru";
import { generateAndPersistMentorAnalysis } from "@/features/ai/server/mentor-analysis-store";
import { aiRizasiVar } from "@/features/kvkk/riza";
import { logger } from "@/lib/logger";

/**
 * #287: Mentör başvurusunun cevaplarını kaydeder.
 *
 * #143 SÖZLEŞMESİ burada da geçerli: bilerek `requireAuth` KULLANILMAZ.
 * requireAuth, APPROVED olmayan kullanıcıyı 403 ile engeller; oysa başvuru
 * tam da hesap PENDING iken doldurulur — onay bu adımdan SONRA gelir.
 * (Stajyer tarafında `server/onboarding.ts` aynı gerekçeyle böyle.)
 *
 * Rol kontrolü yine de yapılır: stajyerin mentör profili yaratmasının bir
 * anlamı yok ve `MentorProfile` eşleştirme havuzunu besliyor.
 */
export async function saveMentorBasvuru(rawData: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Oturum bulunamadı");
  }
  if (session.user.role !== "MENTOR") {
    throw new Error("Bu form yalnızca mentör başvuruları içindir");
  }

  const parse = mentorBasvuruSchema.safeParse(rawData);
  if (!parse.success) {
    throw new Error("Geçersiz veri: " + JSON.stringify(parse.error.flatten()));
  }
  const d = parse.data;

  // Boş dize = doldurmadım. Veritabanında boş dize tutmak, sonradan
  // "bağlantısı var mı?" sorusunu yanlış cevaplardı.
  const bosuAt = (v?: string) => (v && v.trim() ? v : undefined);

  // Başvuru tekrar açılıp güncellenebilir (onay beklerken düzeltme yapmak
  // yasak değil), bu yüzden upsert.
  const profil = await prisma.mentorProfile.upsert({
    where: { userId: session.user.id },
    update: {
      title: d.title,
      company: bosuAt(d.company),
      yearsExperience: d.yearsExperience,
      seniority: d.seniority,
      expertise: d.expertise,
      capacity: d.capacity,
      weeklyHours: d.weeklyHours,
      motivation: d.motivation,
      mentoringStyle: d.mentoringStyle,
      githubUrl: bosuAt(d.githubUrl),
      linkedinUrl: bosuAt(d.linkedinUrl),
      city: bosuAt(d.city),
    },
    create: {
      userId: session.user.id,
      title: d.title,
      company: bosuAt(d.company),
      yearsExperience: d.yearsExperience,
      seniority: d.seniority,
      expertise: d.expertise,
      capacity: d.capacity,
      weeklyHours: d.weeklyHours,
      motivation: d.motivation,
      mentoringStyle: d.mentoringStyle,
      githubUrl: bosuAt(d.githubUrl),
      linkedinUrl: bosuAt(d.linkedinUrl),
      city: bosuAt(d.city),
    },
  });

  // #288: Analiz burada üretiliyor, admin panelinde okunurken DEĞİL —
  // onay ekranı bekletilmemeli ve aynı analiz her açılışta yeniden
  // üretilip kota harcamamalı.
  //
  // #352 — KVKK AÇIK RIZA KAPISI. Mentörün serbest metin cevapları
  // (`motivation`, `mentoringStyle`) Vertex AI'ya, yani ABD'ye gidiyor.
  // Bu kapı YOKTU: #321 rıza mekanizmasını kurmuş ama yalnızca stajyer
  // akışlarına uygulanmıştı, mentör başvurusu açıkta kalmıştı.
  //
  // Rıza YOKSA BAŞVURU YİNE KAYDEDİLİR, sadece analiz üretilmez. Rıza
  // özgür iradeyle verilmeli; vermeyen kişi mentör olamıyorsa rıza özgür
  // sayılmaz (#321'in 1 numaralı kararı).
  //
  // Best-effort: analiz üretilemezse başvuru yine de kaydedilmiş olur.
  // (analyzeMentorProfile zaten yedek döndürüyor; buradaki try/catch
  // yalnızca DB persist hatasına karşı.)
  const rizaVar = await aiRizasiVar(session.user.id);
  if (!rizaVar) {
    logger.info("Mentör başvurusu: AI rızası yok, analiz üretilmedi", {
      mentorProfileId: profil.id,
    });
    return;
  }

  try {
    await generateAndPersistMentorAnalysis(profil.id, {
      title: d.title,
      company: bosuAt(d.company),
      yearsExperience: d.yearsExperience,
      seniority: d.seniority,
      expertise: d.expertise,
      capacity: d.capacity,
      weeklyHours: d.weeklyHours,
      motivation: d.motivation,
      mentoringStyle: d.mentoringStyle,
      city: bosuAt(d.city),
    });
  } catch (error) {
    logger.error("Mentör başvurusu: analiz kaydedilemedi", error);
  }
}
