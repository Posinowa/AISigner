import { describe, it, expect } from "vitest";
import { matchesExtensionSignature } from "./file-signature";

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const GIF_HEADER = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const ZIP_HEADER = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14]);
const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const EXE_HEADER = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // "MZ" — Windows PE
const TEXT_BYTES = new Uint8Array([0x6d, 0x65, 0x72, 0x68, 0x61, 0x62, 0x61]); // "merhaba"

describe("matchesExtensionSignature (#113)", () => {
  it("geçerli binary imzaları kabul eder", () => {
    expect(matchesExtensionSignature(".png", PNG_HEADER)).toBe(true);
    expect(matchesExtensionSignature(".jpg", JPEG_HEADER)).toBe(true);
    expect(matchesExtensionSignature(".jpeg", JPEG_HEADER)).toBe(true);
    expect(matchesExtensionSignature(".gif", GIF_HEADER)).toBe(true);
    expect(matchesExtensionSignature(".webp", WEBP_HEADER)).toBe(true);
    expect(matchesExtensionSignature(".pdf", PDF_HEADER)).toBe(true);
    expect(matchesExtensionSignature(".zip", ZIP_HEADER)).toBe(true);
  });

  it("PNG uzantılı ama PNG imzası taşımayan içeriği reddeder", () => {
    expect(matchesExtensionSignature(".png", EXE_HEADER)).toBe(false);
    expect(matchesExtensionSignature(".png", TEXT_BYTES)).toBe(false);
    expect(matchesExtensionSignature(".png", JPEG_HEADER)).toBe(false);
  });

  it("uzantı-içerik çaprazlamalarını reddeder", () => {
    expect(matchesExtensionSignature(".pdf", ZIP_HEADER)).toBe(false);
    expect(matchesExtensionSignature(".zip", PDF_HEADER)).toBe(false);
    expect(matchesExtensionSignature(".jpg", PNG_HEADER)).toBe(false);
    expect(matchesExtensionSignature(".webp", GIF_HEADER)).toBe(false);
  });

  it("boş/çok kısa içerik binary uzantıda reddedilir", () => {
    expect(matchesExtensionSignature(".png", new Uint8Array(0))).toBe(false);
    expect(matchesExtensionSignature(".webp", new Uint8Array([0x52, 0x49]))).toBe(false);
  });

  it("metin/kod uzantılarında kontrol atlanır (her içerik geçer)", () => {
    expect(matchesExtensionSignature(".txt", EXE_HEADER)).toBe(true);
    expect(matchesExtensionSignature(".md", TEXT_BYTES)).toBe(true);
    expect(matchesExtensionSignature(".js", TEXT_BYTES)).toBe(true);
    expect(matchesExtensionSignature(".py", new Uint8Array(0))).toBe(true);
  });

  it("uzantıyı büyük/küçük harf duyarsız değerlendirir", () => {
    expect(matchesExtensionSignature(".PNG", PNG_HEADER)).toBe(true);
    expect(matchesExtensionSignature(".PNG", TEXT_BYTES)).toBe(false);
  });
});
