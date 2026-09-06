// #265: Profil fotoğrafları için depolama katmanı.
//
// Davranış adım dosyalarıyla (#197) aynı: `GCS_BUCKET` tanımlıysa GCS,
// tanımlı DEĞİLSE yerel disk. Ortak çekirdek `blob.ts` içinde.
//
// Servis, adım dosyalarındaki gibi proxy — signed URL değil. Böylece her
// istekte rotanın oturum kontrolü çalışıyor ve içerik tipini sunucu
// belirliyor.
import path from "path";
import { createBlobStore } from "./blob";

const GCS_PREFIX = "avatars/";
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "avatars");

const store = createBlobStore(GCS_PREFIX, UPLOAD_DIR);

export function avatarStoreGcsMi(): boolean {
  return store.usingGcs();
}

export async function saveAvatar(
  storedName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  return store.save(storedName, buffer, mimeType);
}

export async function readAvatar(storedName: string): Promise<Buffer | null> {
  return store.read(storedName);
}

export async function deleteAvatar(storedName: string): Promise<void> {
  return store.remove(storedName);
}
