// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * #250 — kayıt eylemi rolü SUNUCUDA çözer.
 *
 * Rol istemciden (gizli form alanı) geliyor. Bu testler ayrıcalık
 * yükseltmeyi kilitliyor: hiçbir girdi ADMIN üretemez ve tanınmayan
 * her değer en az ayrıcalıklı role (STUDENT) düşer.
 */

const { createMock, findUniqueMock, mailMock, redirectMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  findUniqueMock: vi.fn(),
  mailMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/auth/prisma", () => ({
  prisma: { user: { create: createMock, findUnique: findUniqueMock } },
}));
vi.mock("@node-rs/argon2", () => ({ hash: vi.fn(async () => "hashed") }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-real-ip", "1.2.3.4"]]),
}));
vi.mock("@/features/auth/server/email-verification", () => ({
  sendVerificationEmail: mailMock,
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: () => ({ allowed: true }) }),
}));

import { signupAction } from "./actions";

function form(basvuruTipi?: string) {
  const f = new FormData();
  f.set("name", "Ayse");
  f.set("lastName", "Yilmaz");
  f.set("email", "ayse@ornek.com");
  f.set("password", "GucluSifre1!");
  f.set("confirmPassword", "GucluSifre1!");
  if (basvuruTipi !== undefined) f.set("basvuruTipi", basvuruTipi);
  return f;
}

async function kaydet(basvuruTipi?: string) {
  try {
    await signupAction({ error: {} }, form(basvuruTipi));
  } catch (e) {
    // redirect() NEXT_REDIRECT fırlatır — başarı yolu budur.
    if (!(e instanceof Error && e.message.includes("NEXT_REDIRECT"))) throw e;
  }
  return createMock.mock.calls[0]?.[0]?.data;
}

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueMock.mockResolvedValue(null);
  createMock.mockResolvedValue({ id: "k1", name: "Ayse" });
});

describe("signupAction — başvuru tipi role çevrilir", () => {
  it("mentör başvurusu MENTOR rolüyle kaydedilir", async () => {
    const data = await kaydet("mentor");
    expect(data.role).toBe("MENTOR");
  });

  it("mentör başvurusu da onaya düşer", async () => {
    const data = await kaydet("mentor");
    expect(data.accountStatus, "başvuru onaysız aktif olmamalı").toBe("PENDING");
  });

  it("alan yoksa STUDENT olur", async () => {
    expect((await kaydet()).role).toBe("STUDENT");
  });

  it("stajyer başvurusu STUDENT olur", async () => {
    expect((await kaydet("stajyer")).role).toBe("STUDENT");
  });
});

describe("signupAction — ayrıcalık yükseltme kapalı", () => {
  it.each(["admin", "ADMIN", "Admin", "administrator", "SUPERUSER", "'; --"])(
    "%s girdisi ADMIN üretmez",
    async (girdi) => {
      const data = await kaydet(girdi);
      expect(data.role).not.toBe("ADMIN");
      expect(data.role).toBe("STUDENT");
    },
  );

  it("hiçbir girdi ADMIN rolü oluşturmaz", async () => {
    const girdiler = ["mentor", "admin", "ADMIN", "", "x"];
    const roller: string[] = [];
    for (const g of girdiler) {
      vi.clearAllMocks();
      findUniqueMock.mockResolvedValue(null);
      createMock.mockResolvedValue({ id: "k1", name: "Ayse" });
      roller.push((await kaydet(g)).role);
    }
    expect(roller).not.toContain("ADMIN");
  });
});

describe("signupAction — doğrulama e-postası (#247 regresyon)", () => {
  it("mentör başvurusunda da doğrulama e-postası gönderilir", async () => {
    await kaydet("mentor");
    expect(mailMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ayse@ornek.com" }),
    );
  });
});
