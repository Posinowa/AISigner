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
//
// #265: GCS/yerel-disk mantığı `blob.ts` çekirdeğine taşındı — profil fotoğrafı
// da aynı davranışa ihtiyaç duyuyordu. Bu modülün dışa açık API'si değişmedi.
import path from "path";
import { createBlobStore } from "./blob";

// Bucket içinde adım dosyaları için klasör öneki.
const GCS_PREFIX = "steps/";

// Yerel disk yolu (GCS yoksa) — eski davranışla birebir aynı.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "steps");

const store = createBlobStore(GCS_PREFIX, UPLOAD_DIR);

/** Depolama backend'i GCS mi (true) yoksa yerel disk mi (false)? */
export function usingGcs(): boolean {
  return store.usingGcs();
}

/** Dosyayı kaydeder (GCS veya yerel disk). */
export async function saveStepFile(
  storedName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  return store.save(storedName, buffer, mimeType);
}

/** Dosyayı okur; yoksa null döner (404'e çevirmek çağıranın işi). */
export async function readStepFile(storedName: string): Promise<Buffer | null> {
  return store.read(storedName);
}

/** Dosyayı siler (yoksa sessizce geçer). */
export async function deleteStepFile(storedName: string): Promise<void> {
  return store.remove(storedName);
}
