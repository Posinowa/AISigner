import { z } from "zod";

// Admin: Rol güncelleme
export const updateRoleSchema = z.object({
  userId: z.string().min(1, "Kullanıcı ID gerekli"),
  role: z.enum(["ADMIN", "MENTOR", "STUDENT"], {
    error: "Geçersiz rol. ADMIN, MENTOR veya STUDENT olmalı.",
  }),
});

// Admin: Mentor atama
export const assignMentorSchema = z.object({
  studentId: z.string().min(1, "Öğrenci ID gerekli"),
  mentorId: z.string().min(1, "Mentor ID gerekli"),
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

// Mentor: Roadmap adım ekleme
export const createStepSchema = z.object({
  title: z.string().min(1, "Başlık zorunlu"),
  description: z.string().min(1, "Açıklama zorunlu"),
  estimatedHours: z.number().int().positive().optional().nullable(),
  resources: z.array(z.string()).default([]),
});

// Mentor: Roadmap adım güncelleme
export const updateStepSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  estimatedHours: z.number().int().positive().optional().nullable(),
  resources: z.array(z.string()).optional(),
  order: z.number().int().positive().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
});

// Mentor: Proje kaldırma
export const unassignProjectSchema = z.object({
  assignedProjectId: z.string().min(1, "Atanmış proje ID gerekli"),
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
