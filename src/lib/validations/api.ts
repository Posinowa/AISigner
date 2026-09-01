import { z } from "zod";

// Admin: Rol güncelleme
export const updateRoleSchema = z.object({
  userId: z.string().min(1, "Kullanıcı ID gerekli"),
  role: z.enum(["ADMIN", "MENTOR", "STUDENT"], {
    error: "Geçersiz rol. ADMIN, MENTOR veya STUDENT olmalı.",
  }),
});

// #195: Admin — öğrencinin mentor LİSTESİNİ ayarla (M:N). Gelen dizi "olması
// gereken tam küme"dir; boş dizi → tüm mentorlar kaldırılır.
export const assignMentorSchema = z.object({
  studentId: z.string().min(1, "Öğrenci ID gerekli"),
  mentorIds: z.array(z.string().min(1)).max(20, "En fazla 20 mentor atanabilir"),
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

// Admin: Stajyer hesap onay durumu güncelleme (approve/reject/graduated)
export const updateAccountStatusSchema = z.object({
  userId: z.string().min(1, "Kullanıcı ID gerekli"),
  accountStatus: z.enum(["PENDING", "APPROVED", "REJECTED", "GRADUATED"], {
    error: "Geçersiz durum. PENDING, APPROVED, REJECTED veya GRADUATED olmalı.",
  }),
});

// #49: Public GitHub repository URL — yalnızca github.com üzerinde
// https://github.com/<owner>/<repo>(...) formatı kabul edilir.
const githubRepoUrlSchema = z
  .string()
  .trim()
  .refine((val) => {
    try {
      const url = new URL(val);
      if (url.protocol !== "https:" || url.hostname !== "github.com") return false;
      // #111: Query/hash pathname'e girmediği için segment kontrolünü geçiyordu
      // (ör. ...?tab=readme, ...#readme). Yalnızca temiz repo kökü kabul edilir.
      if (url.search !== "" || url.hash !== "") return false;
      // #83: Yalnızca repo kökü (owner/repo) kabul edilir; tree/issues/pull gibi
      // daha derin yollar reddedilir (önceki >=2 kontrolü bunları da geçiriyordu).
      const segments = url.pathname.split("/").filter(Boolean);
      return segments.length === 2;
    } catch {
      return false;
    }
  }, "Geçerli bir GitHub repository URL'i girin (ör: https://github.com/kullanici/repo)")
  .nullable()
  .optional();

// Admin: Proje şablonu oluşturma
export const createTemplateSchema = z.object({
  title: z.string().min(1, "Başlık gerekli"),
  description: z.string().min(1, "Açıklama gerekli"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"], {
    error: "Geçersiz zorluk seviyesi. EASY, MEDIUM veya HARD olmalı.",
  }),
  track: z.array(z.string()).default([]),
  githubRepoUrl: githubRepoUrlSchema,
});

// Admin: Proje şablonu güncelleme
export const updateTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  track: z.array(z.string()).optional(),
  githubRepoUrl: githubRepoUrlSchema,
});

// Mentor: Proje atama
export const assignProjectSchema = z.object({
  studentProfileId: z.string().min(1, "Öğrenci profil ID gerekli"),
  projectTemplateId: z.string().min(1, "Proje şablon ID gerekli"),
});

// Mentor: Roadmap oluşturma
export const generateRoadmapSchema = z.object({
  assignedProjectId: z.string().min(1, "Atanmış proje ID gerekli"),
  // #178-4: Var olan yol haritasını silip yeniden üretme. Ham `as` cast yerine
  // şemadan geçer; route yalnızca DRAFT roadmap için siler (PUBLISHED korunur).
  overwrite: z.boolean().optional(),
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

// Mesaj listesi sorgusu.
// #158: Query string'den geldiği için limit `coerce` edilir; şema önceden
// tanımlıydı ama route elle ayrıştırdığı için hiç kullanılmıyordu —
// "abc" NaN'a, "-5" negatif `take`e dönüşüp Prisma'ya sızıyordu.
export const getMessagesSchema = z.object({
  conversationWith: z.string().min(1, "Konuşma partneri ID gerekli"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
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

// ==========================================
// 📮 Öneri & İstek Şemaları (#147)
// ==========================================

export const suggestionTypeEnum = z.enum(["SUGGESTION", "REQUEST"]);
export const suggestionStatusEnum = z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]);

// Stajyer yeni öneri/istek gönderir
export const createSuggestionSchema = z.object({
  type: suggestionTypeEnum,
  title: z
    .string()
    .min(3, "Başlık en az 3 karakter olmalı")
    .max(120, "Başlık en fazla 120 karakter olabilir")
    .transform((val) => val.trim()),
  content: z
    .string()
    .min(10, "Açıklama en az 10 karakter olmalı")
    .max(2000, "Açıklama en fazla 2000 karakter olabilir")
    .transform((val) => val.trim()),
});

// #163: Öneri listelerinde cursor tabanlı sayfalama. Query string'den geldiği
// için limit coerce edilir (mesajlaşmadaki getMessagesSchema ile aynı desen).
export const listSuggestionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Yalnızca admin listesinde kullanılır; öğrenci ucunda yok sayılır.
  status: suggestionStatusEnum.optional(),
});

// Yönetici durum / not günceller — en az bir alan gönderilmeli
export const updateSuggestionSchema = z
  .object({
    status: suggestionStatusEnum.optional(),
    adminNote: z
      .string()
      .max(2000, "Not en fazla 2000 karakter olabilir")
      .transform((val) => val.trim())
      .optional(),
  })
  .refine((data) => data.status !== undefined || data.adminNote !== undefined, {
    message: "Güncellenecek en az bir alan gönderilmeli",
  });

// ==========================================
// 🎓 Sertifika ve Mezuniyet Şemaları (#204, #208)
// ==========================================

export const completionGradeEnum = z.enum([
  "Üstün Başarı",
  "Onur Derecesi",
  "Yüksek Başarı",
  "Başarılı",
]);

export const updateCertificateSchema = z.object({
  certificateNumber: z.string().min(1).max(50).optional(),
  mentorNote: z
    .string()
    .max(2000, "Referans notu en fazla 2000 karakter olabilir.")
    .optional()
    .nullable(),
  completionGrade: completionGradeEnum.optional().nullable(),
});


// #349: Çalışma alanı talebi (mentör açar, admin karara bağlar).
export const createWorkspaceRequestSchema = z.object({
  assignedProjectId: z.string().min(1, "Atama ID'si gerekli"),
  // Gerekçe opsiyonel; uzunluk sınırı şemadaki VarChar(500) ile aynı.
  mentorNote: z.string().max(500, "Not en fazla 500 karakter olabilir").optional(),
});

export const decideWorkspaceRequestSchema = z.object({
  onay: z.boolean(),
  // Reddin gerekçesi ZORUNLU ama bu kural sunucu katmanında: burada
  // `onay: false` ile boş not ayrımı yapmak şemayı `superRefine` ile
  // karmaşıklaştırırdı ve kural iki yerde tekrarlanırdı.
  adminNote: z.string().max(500, "Not en fazla 500 karakter olabilir").optional(),
});
