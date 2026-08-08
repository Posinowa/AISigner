import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { isAssignedMentor } from "@/lib/auth/mentor-access";
import { createRateLimiter } from "@/lib/rate-limit";
import { matchesExtensionSignature } from "@/lib/file-signature";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const limiter = createRateLimiter("file-upload", {
  maxRequests: 10,
  windowSeconds: 60,
});

// Uzantı → güvenli MIME type eşlemesi (client MIME type'ına güvenme!)
const SAFE_MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/plain",
  ".csv": "text/plain",
  ".json": "application/json",
  ".zip": "application/zip",
  ".js": "text/plain",
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".jsx": "text/plain",
  ".css": "text/plain",
  ".py": "text/plain",
  ".java": "text/plain",
  ".go": "text/plain",
  ".rs": "text/plain",
  ".c": "text/plain",
  ".cpp": "text/plain",
  ".h": "text/plain",
  ".sql": "text/plain",
};

const ALLOWED_EXTENSIONS = Object.keys(SAFE_MIME_MAP);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
// ⚠️ ÖLÇEKLEME: Yerel disk. Tek instance'ta kalıcı volume ile çalışır; çok
// instance/serverless'ta GCS/S3'e taşıyın (bkz. DEPLOYMENT.md).
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "steps");

/**
 * GET /api/steps/[stepId]/files
 * Adıma ait dosyaları listeler.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId } = await params;
  const userId = auth.session.user.id!;

  try {
    const step = await getStepWithAccess(stepId, userId);
    if (!step) {
      return NextResponse.json(
        { error: "Adım bulunamadı veya erişim yetkiniz yok." },
        { status: 404 }
      );
    }

    const files = await prisma.stepFile.findMany({
      where: { stepId },
      orderBy: { createdAt: "desc" },
      include: {
        uploader: {
          select: { id: true, name: true, lastName: true, role: true },
        },
      },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("GET /api/steps/[stepId]/files error:", error);
    return NextResponse.json(
      { error: "Dosyalar yüklenirken hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/steps/[stepId]/files
 * Adıma dosya yükler. FormData ile multipart/form-data.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const auth = await requireAuth(["MENTOR", "STUDENT"]);
  if (!auth.authorized) return auth.response;

  const { stepId } = await params;
  const userId = auth.session.user.id!;

  const rl = limiter.check(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla dosya yükleme denemesi. Lütfen biraz bekleyin." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    // Erişim kontrolü
    const step = await getStepWithAccess(stepId, userId);
    if (!step) {
      return NextResponse.json(
        { error: "Adım bulunamadı veya erişim yetkiniz yok." },
        { status: 404 }
      );
    }

    // #52: Öğrenci yalnızca PUBLISHED roadmap adımına dosya yükleyebilir.
    // Mentor, taslağı (DRAFT) inceleme/düzenleme için yükleyebilir.
    const isStudent = step.roadmap.assignedProject.studentProfile.userId === userId;
    if (isStudent && step.roadmap.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Bu yol haritası henüz yayınlanmadı. Yayınlandığında etkileşim kurabilirsiniz." },
        { status: 403 }
      );
    }

    // Bu adıma ait dosya sayısını kontrol et (max 10)
    const fileCount = await prisma.stepFile.count({ where: { stepId } });
    if (fileCount >= 10) {
      return NextResponse.json(
        { error: "Bu adıma en fazla 10 dosya yüklenebilir." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Dosya seçilmedi." },
        { status: 400 }
      );
    }

    // Dosya boyutu kontrolü
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Dosya boyutu 10 MB'dan büyük olamaz." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Boş dosya yüklenemez." },
        { status: 400 }
      );
    }

    // Dosya uzantısı kontrolü
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Bu dosya tipi desteklenmiyor. İzin verilen: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Sunucu tarafı MIME type belirleme (client'a güvenme - XSS önleme)
    const mimeType = SAFE_MIME_MAP[ext] || "application/octet-stream";

    // Benzersiz dosya adı oluştur (path traversal önleme)
    const uniqueId = crypto.randomBytes(16).toString("hex");
    const safeExt = ext.replace(/[^a-z0-9.]/gi, "");
    const storedName = `${stepId}_${uniqueId}${safeExt}`;

    // Upload dizinini oluştur
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // #113: Binary formatlarda dosya içeriği (magic bytes) uzantıyla eşleşmeli.
    // Uzantı whitelist'i tek başına yeterli değil — .png adlı bir çalıştırılabilir
    // içerik burada reddedilir. Metin/kod dosyaları için kontrol atlanır.
    if (!matchesExtensionSignature(ext, buffer)) {
      return NextResponse.json(
        { error: "Dosya içeriği uzantısıyla uyuşmuyor. Lütfen geçerli bir dosya yükleyin." },
        { status: 400 }
      );
    }

    // Dosyayı diske yaz
    const filePath = path.join(UPLOAD_DIR, storedName);
    await writeFile(filePath, buffer);

    // Veritabanına kaydet
    const stepFile = await prisma.stepFile.create({
      data: {
        stepId,
        uploaderId: userId,
        fileName: file.name.slice(0, 255), // Max 255 karakter
        storedName,
        mimeType,
        fileSize: file.size,
      },
      include: {
        uploader: {
          select: { id: true, name: true, lastName: true, role: true },
        },
      },
    });

    return NextResponse.json({ file: stepFile }, { status: 201 });
  } catch (error) {
    console.error("POST /api/steps/[stepId]/files error:", error);
    return NextResponse.json(
      { error: "Dosya yüklenirken hata oluştu." },
      { status: 500 }
    );
  }
}

/**
 * Adımın erişim yetkisini kontrol eder.
 */
async function getStepWithAccess(stepId: string, userId: string) {
  const step = await prisma.roadmapStep.findUnique({
    where: { id: stepId },
    include: {
      roadmap: {
        include: {
          assignedProject: {
            include: {
              studentProfile: {
                include: { mentorAssignments: { select: { mentorId: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!step) return null;

  const profile = step.roadmap.assignedProject.studentProfile;
  if (profile.userId === userId) return step;
  // #195: M:N — öğrencinin mentorlarından biri mi?
  if (isAssignedMentor(profile.mentorAssignments, userId)) return step;

  return null;
}
