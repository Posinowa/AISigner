/**
 * #113: Uzantı ↔ dosya içeriği (magic bytes) doğrulaması.
 *
 * Yalnızca binary formatlar kontrol edilir — metin/kod dosyalarının (txt, md,
 * js, py...) güvenilir bir imzası olmadığından onlar için kontrol atlanır.
 * Harici bağımlılık gerektirmez; yalnızca dosyanın ilk baytları karşılaştırılır.
 */

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

const BINARY_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  ".png": (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ".jpg": (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  ".jpeg": (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  ".gif": (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]), // "GIF8"
  ".webp": (b) =>
    // RIFF....WEBP — 0-3 "RIFF", 8-11 "WEBP" (4-7 dosya boyutudur, atlanır)
    startsWith(b, [0x52, 0x49, 0x46, 0x46]) &&
    b.length >= 12 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
  ".pdf": (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]), // "%PDF"
  ".zip": (b) =>
    startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || // normal arşiv
    startsWith(b, [0x50, 0x4b, 0x05, 0x06]) || // boş arşiv
    startsWith(b, [0x50, 0x4b, 0x07, 0x08]), // bölünmüş arşiv
};

/**
 * Dosya içeriğinin uzantısıyla tutarlı olup olmadığını döner.
 * Binary olmayan uzantılar (imza tanımı yok) her zaman `true` döner.
 */
export function matchesExtensionSignature(ext: string, bytes: Uint8Array): boolean {
  const check = BINARY_SIGNATURES[ext.toLowerCase()];
  if (!check) return true;
  return check(bytes);
}
