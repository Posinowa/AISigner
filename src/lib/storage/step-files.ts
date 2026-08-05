// #197: Adım dosyaları (StepFile) için depolama katmanı.
//
// Amaç: yüklenen dosyalar deploy'da kaybolmasın. `GCS_BUCKET` env tanımlıysa
// Google Cloud Storage kullanılır; tanımlı DEĞİLSE yerel diske düşer (dev +
// tek-instance eski davranış). Böylece AI entegrasyonundaki graceful-degradation
// deseniyle tutarlı kalırız: env yoksa yerel disk, varsa bulut.
//
// GCS kimliği ayrı bir şey gerektirmez — mevcut Application Default Credentials
// (docker-entrypoint.sh'ın yazdığı GOOGLE_APPLICATION_CREDENTIALS) kullanılır.
//
// İndirme bilinçli olarak signed URL DEĞİL, proxy (route dosyayı okuyup akıtır):
// böylece her istekte route'un yetki kontrolü (sahip/atanmış mentör) korunur.
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { Bucket } from "@google-cloud/storage";

const GCS_BUCKET = process.env.GCS_BUCKET;
// Bucket içinde adım dosyaları için klasör öneki.
const GCS_PREFIX = "steps/";

// Yerel disk yolu (GCS yoksa) — eski davranışla birebir aynı.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "steps");

// GCS istemcisi tembel yüklenir — env yoksa paket hiç import edilmez.
let bucketPromise: Promise<Bucket> | null = null;
async function getBucket(): Promise<Bucket> {
  if (!bucketPromise) {
    bucketPromise = import("@google-cloud/storage").then(
      ({ Storage }) => new Storage().bucket(GCS_BUCKET as string),
    );
  }
  return bucketPromise;
}

/** Depolama backend'i GCS mi (true) yoksa yerel disk mi (false)? */
export function usingGcs(): boolean {
  return Boolean(GCS_BUCKET);
}

/** Dosyayı kaydeder (GCS veya yerel disk). */
export async function saveStepFile(
  storedName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  if (GCS_BUCKET) {
    const bucket = await getBucket();
    await bucket.file(GCS_PREFIX + storedName).save(buffer, {
      resumable: false,
      contentType: mimeType,
    });
    return;
  }
  if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);
}

/** Dosyayı okur; yoksa null döner (404'e çevirmek çağıranın işi). */
export async function readStepFile(storedName: string): Promise<Buffer | null> {
  if (GCS_BUCKET) {
    const bucket = await getBucket();
    try {
      const [buf] = await bucket.file(GCS_PREFIX + storedName).download();
      return buf;
    } catch (err) {
      // GCS "yok" hatası (404) → null; diğer hatalar yükseltilir.
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  }
  const filePath = path.join(UPLOAD_DIR, storedName);
  if (!existsSync(filePath)) return null;
  return readFile(filePath);
}

/** Dosyayı siler (yoksa sessizce geçer). */
export async function deleteStepFile(storedName: string): Promise<void> {
  if (GCS_BUCKET) {
    const bucket = await getBucket();
    await bucket.file(GCS_PREFIX + storedName).delete({ ignoreNotFound: true });
    return;
  }
  const filePath = path.join(UPLOAD_DIR, storedName);
  if (existsSync(filePath)) await unlink(filePath);
}
