import { describe, it, expect } from "vitest";
import { resimTipiniBelirle, tipeGoreUzanti } from "./images";

/**
 * #265 — içerik doğrulaması.
 *
 * Asıl risk: uzantı ve istemci MIME'ı saldırganın kontrolünde. Bu testler
 * "resim gibi görünen ama resim olmayan" dosyaların reddedildiğini kilitliyor.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF87 = Buffer.from("GIF87a....", "latin1");
const GIF89 = Buffer.from("GIF89a....", "latin1");

function webp(): Buffer {
  const b = Buffer.alloc(16);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(8, 4);
  b.write("WEBP", 8, "latin1");
  return b;
}

describe("resimTipiniBelirle — gerçek resimler", () => {
  it.each([
    ["PNG", PNG, "image/png"],
    ["JPEG", JPEG, "image/jpeg"],
    ["GIF87a", GIF87, "image/gif"],
    ["GIF89a", GIF89, "image/gif"],
    ["WebP", webp(), "image/webp"],
  ] as const)("%s tanınır", (_ad, buf, beklenen) => {
    expect(resimTipiniBelirle(buf)).toBe(beklenen);
  });
});

describe("resimTipiniBelirle — SVG reddedilir", () => {
  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<?xml version="1.0"?><svg onload="alert(1)"/>',
    "   <svg/>",
  ])("SVG içeriği resim SAYILMAZ", (icerik) => {
    // SVG'ye script gömülebiliyor; profil fotoğrafı için de gerekli değil.
    expect(resimTipiniBelirle(Buffer.from(icerik, "utf8"))).toBeNull();
  });
});

describe("resimTipiniBelirle — resim taklidi içerik", () => {
  it.each([
    ["HTML", "<!doctype html><html><script>alert(1)</script></html>"],
    ["düz metin", "bu bir resim degil"],
    ["PHP", "<?php system($_GET['c']); ?>"],
    ["boş", ""],
  ])("%s reddedilir", (_ad, icerik) => {
    expect(resimTipiniBelirle(Buffer.from(icerik, "utf8"))).toBeNull();
  });

  it("PNG imzası GÖVDEDE geçse bile başta değilse reddedilir", () => {
    // İmza yalnızca dosyanın başında anlamlı.
    const sahte = Buffer.concat([
      Buffer.from("<html>", "utf8"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ]);
    expect(resimTipiniBelirle(sahte)).toBeNull();
  });

  it("eksik imza (kısa dosya) reddedilir", () => {
    expect(resimTipiniBelirle(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  it("RIFF ama WEBP olmayan dosya reddedilir", () => {
    // RIFF konteyneri WAV/AVI de olabilir; WEBP etiketi şart.
    const b = Buffer.alloc(16);
    b.write("RIFF", 0, "latin1");
    b.write("WAVE", 8, "latin1");
    expect(resimTipiniBelirle(b)).toBeNull();
  });

  it("yalnızca RIFF olup devamı eksik olan dosya reddedilir", () => {
    expect(resimTipiniBelirle(Buffer.from("RIFF", "latin1"))).toBeNull();
  });
});

describe("tipeGoreUzanti", () => {
  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
  ] as const)("%s → %s", (tip, beklenen) => {
    expect(tipeGoreUzanti(tip)).toBe(beklenen);
  });
});
