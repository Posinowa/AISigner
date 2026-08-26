// #265: Depolama çekirdeği.
//
// #197'de adım dosyaları için yazılan GCS/yerel-disk mantığı `steps/` önekine
// sabitlenmişti. Profil fotoğrafı da aynı davranışa ihtiyaç duyuyor; aynı
// kodu ikinci kez yazmak yerine çekirdek buraya çıkarıldı.
//
// Davranış #197 ile birebir aynı: `GCS_BUCKET` tanımlıysa Google Cloud
// Storage, tanımlı DEĞİLSE yerel disk (dev + tek-instance). Yerel disk
// çok-instance/deploy'da kalıcı değildir.
//
// GCS istemcisi tembel yüklenir — env yoksa paket hiç import edilmez.
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { Bucket } from "@google-cloud/storage";

export type BlobStore = {
  usingGcs(): boolean;
  save(storedName: string, buffer: Buffer, mimeType: string): Promise<void>;
  /** Yoksa null döner (404'e çevirmek çağıranın işi). */
  read(storedName: string): Promise<Buffer | null>;
  /** Yoksa sessizce geçer. */
  remove(storedName: string): Promise<void>;
};

function gcsBucketAdi(): string | undefined {
  return process.env.GCS_BUCKET;
}

/**
 * Bucket örneği önek başına önbelleklenir.
 *
 * Not: `GCS_BUCKET` çalışma anında değişmez; test ortamında env değiştiğinde
 * önbellek `resetBlobCacheForTests` ile temizlenebilir.
 */
const bucketOnbellek = new Map<string, Promise<Bucket>>();

async function getBucket(onek: string): Promise<Bucket> {
  const bucketName = gcsBucketAdi();
  if (!bucketName) {
    throw new Error("GCS_BUCKET is not configured.");
  }

  const anahtar = `${bucketName}:${onek}`;
  let mevcut = bucketOnbellek.get(anahtar);
  if (!mevcut) {
    // GCS_API_ENDPOINT: yalnızca yerel emülatör/test içindir (ör. fake-gcs-server).
    // Prod'da tanımlanmaz → gerçek GCS'e ADC ile bağlanılır.
    mevcut = import("@google-cloud/storage").then(({ Storage }) => {
      const opts = process.env.GCS_API_ENDPOINT
        ? {
            apiEndpoint: process.env.GCS_API_ENDPOINT,
            projectId: process.env.GOOGLE_CLOUD_PROJECT || "local",
          }
        : {};
      return new Storage(opts).bucket(bucketName);
    });
    bucketOnbellek.set(anahtar, mevcut);
  }
  return mevcut;
}

export function resetBlobCacheForTests(): void {
  bucketOnbellek.clear();
}

/**
 * Bir depolama alanı üretir.
 *
 * @param gcsPrefix bucket içindeki klasör öneki (ör. "steps/")
 * @param yerelDizin GCS yokken kullanılacak disk yolu
 */
export function createBlobStore(gcsPrefix: string, yerelDizin: string): BlobStore {
  const usingGcs = () => Boolean(gcsBucketAdi());

  return {
    usingGcs,

    async save(storedName, buffer, mimeType) {
      if (usingGcs()) {
        const bucket = await getBucket(gcsPrefix);
        await bucket.file(gcsPrefix + storedName).save(buffer, {
          resumable: false,
          contentType: mimeType,
        });
        return;
      }
      if (!existsSync(yerelDizin)) await mkdir(yerelDizin, { recursive: true });
      await writeFile(path.join(yerelDizin, storedName), buffer);
    },

    async read(storedName) {
      if (usingGcs()) {
        const bucket = await getBucket(gcsPrefix);
        try {
          const [buf] = await bucket.file(gcsPrefix + storedName).download();
          return buf;
        } catch (err) {
          // GCS "yok" hatası (404) → null; diğer hatalar yükseltilir.
          if ((err as { code?: number }).code === 404) return null;
          throw err;
        }
      }
      const filePath = path.join(yerelDizin, storedName);
      if (!existsSync(filePath)) return null;
      return readFile(filePath);
    },

    async remove(storedName) {
      if (usingGcs()) {
        const bucket = await getBucket(gcsPrefix);
        await bucket.file(gcsPrefix + storedName).delete({ ignoreNotFound: true });
        return;
      }
      const filePath = path.join(yerelDizin, storedName);
      if (existsSync(filePath)) await unlink(filePath);
    },
  };
}
