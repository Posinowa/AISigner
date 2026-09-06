// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #265 — fotoğraf servisi.
 *
 * Kritik: içerik tipi DEPODAN OKUNAN veriden belirlenir ve tarayıcının tip
 * tahmini kapatılır. Aksi halde depoya sızmış bir dosya resim kılığında
 * başka bir şey olarak yorumlanabilir.
 */

const { authMock, prismaMock, readMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: { user: { findUnique: vi.fn() } },
  readMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({ requireAuth: (...a: unknown[]) => authMock(...a) }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/storage/avatars", () => ({ readAvatar: (...a: unknown[]) => readMock(...a) }));

import { GET } from "./route";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);

const ctx = (userId = "k2") => ({ params: Promise.resolve({ userId }) });
const cagir = (userId?: string) => GET(new Request("http://t"), ctx(userId));

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "k1", role: "ADMIN" } },
  });
  prismaMock.user.findUnique.mockResolvedValue({ avatarFile: "a.png" });
  readMock.mockResolvedValue(PNG);
});

describe("GET — yetki", () => {
  it("oturumsuz erişim reddedilir", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    const r = await cagir();

    expect(r.status).toBe(401);
    expect(readMock, "yetkisiz istekte depoya gidilmemeli").not.toHaveBeenCalled();
  });

  it("oturum açmış kullanıcı BAŞKASININ fotoğrafını görebilir", async () => {
    // Admin başvuruyu değerlendirirken, mentör öğrencisini tanırken gerekiyor.
    const r = await cagir("baska-kullanici");
    expect(r.status).toBe(200);
  });
});

describe("GET — servis başlıkları", () => {
  it("içerik tipi DEPODAKİ veriden belirlenir", async () => {
    const r = await cagir();
    expect(r.headers.get("Content-Type")).toBe("image/png");
  });

  it("tarayıcı tip tahmini kapatılır", async () => {
    const r = await cagir();
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("önbellek private'tır", async () => {
    // Paylaşımlı önbellekte tutulursa başka kullanıcıya servis edilebilir.
    expect((await cagir()).headers.get("Cache-Control")).toMatch(/private/);
  });
});

describe("GET — bulunamayan durumlar", () => {
  it("kullanıcının fotoğrafı yoksa 404", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ avatarFile: null });

    expect((await cagir()).status).toBe(404);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("kullanıcı yoksa 404", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect((await cagir()).status).toBe(404);
  });

  it("DB'de kayıt var ama dosya yoksa 404", async () => {
    readMock.mockResolvedValue(null);
    expect((await cagir()).status).toBe(404);
  });

  it("depodaki içerik resim DEĞİLSE servis edilmez", async () => {
    // Depoya bir şekilde resim olmayan içerik girdiyse akıtılmamalı.
    readMock.mockResolvedValue(Buffer.from("<script>alert(1)</script>", "utf8"));

    const r = await cagir();

    expect(r.status).toBe(404);
    expect(r.headers.get("Content-Type")).not.toMatch(/image/);
  });
});
