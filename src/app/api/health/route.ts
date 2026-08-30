import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Sağlık kontrolü.
 *
 * Öncesi yalnızca `SELECT 1` atıp `{status:"ok"}` dönüyordu. Bu, "ayakta mı"
 * sorusunu yanıtlıyor ama operasyonda asıl sorulan iki soruyu yanıtlamıyordu:
 * **hangi sürüm koşuyor** ve **ne kadardır ayakta**. Deploy sonrası "yeni sürüm
 * gerçekten yayına çıktı mı?" sorusu, sürüm bilgisi olmadan ancak davranışa
 * bakarak tahmin edilebiliyordu.
 *
 * Sürüm bilgisi platformun verdiği commit SHA'sından okunur; yoksa package.json
 * sürümüne düşer. Bilgi ifşası açısından zararsız: commit SHA'sı zaten public
 * repo'da, gizli bir şey içermiyor.
 */

// Bu uç ASLA önbelleklenmemeli — önbelleklenmiş bir "ok" yanıtı, veritabanı
// düşmüşken bile sağlıklı görünmeye yol açar (izlemenin en tehlikeli yalanı).
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASLANGIC = Date.now();

/** Platformların commit SHA'sını verdiği yaygın env adları. */
function surum(): string {
  return (
    // Platformun çalışma-anı değişkenleri önce: imaj yeniden kurulmadan
    // yeniden deploy edilmiş olabilir.
    process.env.GIT_COMMIT_SHA ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.SOURCE_COMMIT ??
    // Docker imajına build sırasında gömülen damga (Dockerfile ARG APP_VERSION).
    // standalone imajda npm bulunmadığı için npm_package_version tanımsızdır —
    // yalnız `npm start` ile koşan yerel/geliştirme senaryosunda dolar.
    (process.env.APP_VERSION && process.env.APP_VERSION !== "bilinmiyor"
      ? process.env.APP_VERSION
      : undefined) ??
    process.env.npm_package_version ??
    "bilinmiyor"
  );
}

export async function GET() {
  const govde = {
    version: surum(),
    uptimeSeconds: Math.floor((Date.now() - BASLANGIC) / 1000),
    timestamp: new Date().toISOString(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected", ...govde }, { status: 200 });
  } catch (error) {
    // Hata DETAYI yanıta konmaz (bağlantı dizesi/host sızabilir); yalnız loglanır.
    logger.error("Healthcheck başarısız", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "error", db: "disconnected", ...govde }, { status: 500 });
  }
}
