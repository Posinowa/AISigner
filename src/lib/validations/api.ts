import { z } from "zod";

// Admin: Rol güncelleme
export const updateRoleSchema = z.object({
  userId: z.string().min(1, "Kullanıcı ID gerekli"),
  role: z.enum(["ADMIN", "MENTOR", "STUDENT"], {
    error: "Geçersiz rol. ADMIN, MENTOR veya STUDENT olmalı.",
  }),
});

// Admin: Mentor atama (mentorId null → atamayı kaldır)
export const assignMentorSchema = z.object({
  studentId: z.string().min(1, "Öğrenci ID gerekli"),
  mentorId: z.string().nullable(),
});

// ==========================================
// 📋 Anket (Survey) Şemaları — #45
// ==========================================

// Admin: Anket sorusu oluşturma
export const createSurveyQuestionSchema = z.object({
  question: z.string().min(1, "Soru metni gerekli").max(500, "Soru en fazla 500 karakter olabilir"),
  options: z.array(z.string().min(1, "Seçenek boş olamaz").max(200)).max(20, "En fazla 20 seçenek").default([]),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Admin: Anket sorusu güncelleme/pasifleştirme (kısmi)
export const updateSurveyQuestionSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  options: z.array(z.string().min(1).max(200)).max(20).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Öğrenci: Anket cevaplarını kaydetme (toplu)
export const saveSurveyAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1, "Soru ID gerekli"),
        answer: z.string().min(1, "Cevap boş olamaz").max(2000, "Cevap en fazla 2000 karakter olabilir"),
      }),
    )
    .min(1, "En az bir cevap gerekli"),
});

// Admin: Stajyer hesap onay durumu güncelleme (approve/reject)
export const updateAccountStatusSchema = z.object({
  userId: z.string().min(1, "Kullanıcı ID gerekli"),
  accountStatus: z.enum(["PENDING", "APPROVED", "REJECTED"], {
    error: "Geçersiz durum. PENDING, APPROVED veya REJECTED olmalı.",
  }),
});

// Admin: Proje şablonu oluşturma
export const createTemplateSchema = z.object({
  title: z.string().min(1, "Başlık gerekli"),
  description: z.string().min(1, "Açıklama gerekli"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"], {
    error: "Geçersiz zorluk seviyesi. EASY, MEDIUM veya HARD olmalı.",
  }),
  track: z.array(z.string()).default([]),
});

// Admin: Proje şablonu güncelleme
export const updateTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  track: z.array(z.string()).optional(),
});

// Mentor: Proje atama
export const assignProjectSchema = z.object({
  studentProfileId: z.string().min(1, "Öğrenci profil ID gerekli"),
  projectTemplateId: z.string().min(1, "Proje şablon ID gerekli"),
});

// Mentor: Roadmap oluşturma
export const generateRoadmapSchema = z.object({
  assignedProjectId: z.string().min(1, "Atanmış proje ID gerekli"),
});

// Mentor: AI proje önerisi
export const recommendProjectsSchema = z.object({
  studentProfileId: z.string().min(1, "Öğrenci profil ID gerekli"),
});

// Mentor: Roadmap güncelleme
export const updateRoadmapSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

// #50: GitHub issue URL — https://github.com/<owner>/<repo>/issues/<number> formatı zorunlu.
const githubIssueUrlSchema = z
  .string()
  .trim()
  .refine((val) => {
    try {
      const url = new URL(val);
      if (url.protocol !== "https:" || url.hostname !== "github.com") return false;
      const segments = url.pathname.split("/").filter(Boolean);
      return segments.length === 4 && segments[2] === "issues" && /^\d+$/.test(segments[3]);
    } catch {
      return false;
    }
  }, "Geçerli bir GitHub issue URL'i girin (ör: https://github.com/kullanici/repo/issues/12)")
  .nullable()
  .optional();

// Mentor: Roadmap adım ekleme
export const createStepSchema = z.object({
  title: z.string().min(1, "Başlık zorunlu"),
  description: z.string().min(1, "Açıklama zorunlu"),
  estimatedHours: z.number().int().positive().optional().nullable(),
  resources: z.array(z.string()).default([]),
  githubIssueUrl: githubIssueUrlSchema,
});

// Mentor: Roadmap adım güncelleme
export const updateStepSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  estimatedHours: z.number().int().positive().optional().nullable(),
  resources: z.array(z.string()).optional(),
  order: z.number().int().positive().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
  githubIssueUrl: githubIssueUrlSchema,
});

// Mentor: Proje kaldırma
export const unassignProjectSchema = z.object({
  assignedProjectId: z.string().min(1, "Atanmış proje ID gerekli"),
  force: z.boolean().optional(),
});

// Student: Adım durumu güncelleme
export const updateStepStatusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
});

// ==========================================
// 💬 Mesajlaşma ve Yorum Şemaları
// ==========================================

// Mesaj gönderme
export const sendMessageSchema = z.object({
  receiverId: z.string().min(1, "Alıcı ID gerekli"),
  content: z
    .string()
    .min(1, "Mesaj boş olamaz")
    .max(2000, "Mesaj en fazla 2000 karakter olabilir")
    .transform((val) => val.trim()),
});

// Mesaj listesi sorgusu
export const getMessagesSchema = z.object({
  conversationWith: z.string().min(1, "Konuşma partneri ID gerekli"),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(30),
});

// Adıma yorum ekleme
export const createStepCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Yorum boş olamaz")
    .max(1000, "Yorum en fazla 1000 karakter olabilir")
    .transform((val) => val.trim()),
});

// Yorum güncelleme
export const updateStepCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Yorum boş olamaz")
    .max(1000, "Yorum en fazla 1000 karakter olabilir")
    .transform((val) => val.trim()),
});
