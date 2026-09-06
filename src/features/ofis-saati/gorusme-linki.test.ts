// @vitest-environment node
import { describe, it, expect } from "vitest";

/**
 * Görüşme bağlantısı doğrulaması (#398).
 *
 * ⚠️ Link MENTÖRÜN GİRDİĞİ METİN ve stajyer ona tıklıyor. `javascript:` gibi
 * şemalar kabul edilirse tıklanan yerde kod çalışır.
 */

import { gorusmeLinkiSchema } from "@/lib/validations/api";

const gecerli = (link: string) => gorusmeLinkiSchema.safeParse({ link }).success;

describe("kabul edilenler", () => {
  it.each([
    "https://meet.google.com/abc-defg-hij",
    "https://zoom.us/j/123456789",
    "http://localhost:3000/oda",
  ])("%s kabul edilir", (link) => {
    expect(gecerli(link)).toBe(true);
  });

  it("boş bırakmak serbest — link zorunlu değil", () => {
    expect(gecerli("")).toBe(true);
  });
});

describe("reddedilenler", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("⚠️ %s REDDEDİLİR", (link) => {
    expect(gecerli(link)).toBe(false);
  });

  it("URL olmayan metin reddedilir", () => {
    expect(gecerli("meet.google.com/abc")).toBe(false);
  });

  it("aşırı uzun metin reddedilir", () => {
    expect(gecerli("https://a.com/" + "x".repeat(600))).toBe(false);
  });
});
