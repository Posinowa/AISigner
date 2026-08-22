// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #265 — profil fotoğrafı yükleme sözleşmesi.
 *
 * İki kritik davranış:
 * - hedef kullanıcı OTURUMDAN gelir; kimse başkasının fotoğrafını değiştiremez
 * - dosyanın resim olduğu İÇERİĞİNDEN doğrulanır, uzantıya güvenilmez
 */

const { authMock, prismaMock, saveMock, deleteMock, limitMock, loggerMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
    saveMock: vi.fn(),
    deleteMock: vi.fn(),
    limitMock: vi.fn(),
    loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));

vi.mock("@/lib/auth/guard", () => ({ requireAuth: (...a: unknown[]) => authMock(...a) }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: (...a: unknown[]) => limitMock(...a) }),
}));
vi.mock("@/lib/storage/avatars", () => ({
  saveAvatar: (...a: unknown[]) => saveMock(...a),
  deleteAvatar: (...a: unknown[]) => deleteMock(...a),
}));

import { POST, DELETE } from "./route";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function istek(icerik: Buffer | string, ad = "foto.png") {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(Buffer.from(icerik))], ad));
  return new Request("http://t/api/profile/avatar", { method: "POST", body: form });
}

async function yukle(icerik: Buffer | string, ad?: string) {
  const r = await POST(istek(icerik, ad));
  return { durum: r.status, govde: await r.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "k1", role: "STUDENT" } },
  });
  limitMock.mockReturnValue({ allowed: true });
  prismaMock.user.findUnique.mockResolvedValue({ avatarFile: null });
  prismaMock.user.update.mockResolvedValue({});
  saveMock.mockResolvedValue(undefined);
  deleteMock.mockResolvedValue(undefined);
});

describe("POST — yetki", () => {
  it("oturum yoksa reddedilir", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    const r = await POST(istek(PNG));

    expect(r.status).toBe(401);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("fotoğraf OTURUMDAKİ kullanıcıya yazılır", async () => {
    await yukle(PNG);

    expect(prismaMock.user.update.mock.calls[0][0].where).toEqual({ id: "k1" });
  });

  it("gövdeden gelen userId YOK SAYILIR", async () => {
    // Hedef kullanıcı gövdeden alınsaydı başkasının fotoğrafı değiştirilebilirdi.
    const form = new FormData();
    form.set("file", new File([new Uint8Array(PNG)], "f.png"));
    form.set("userId", "baskasi");

    await POST(new Request("http://t", { method: "POST", body: form }));

    expect(prismaMock.user.update.mock.calls[0][0].where).toEqual({ id: "k1" });
  });
});

describe("POST — içerik doğrulaması", () => {
  it("gerçek PNG kabul edilir", async () => {
    const r = await yukle(PNG);

    expect(r.durum).toBe(200);
    expect(saveMock).toHaveBeenCalled();
  });

  it("içerik tipi İSTEMCİDEN değil dosyadan belirlenir", async () => {
    await yukle(PNG, "foto.jpg"); // uzantı yanıltıcı

    expect(saveMock.mock.calls[0][2], "imzaya göre PNG olmalı").toBe("image/png");
  });

  it("depolama adı içerikten türeyen uzantıyı taşır", async () => {
    await yukle(PNG, "foto.jpg");
    expect(saveMock.mock.calls[0][0]).toMatch(/\.png$/);
  });

  it.each([
    ["HTML", "<!doctype html><script>alert(1)</script>"],
    ["SVG", '<svg onload="alert(1)"/>'],
    ["düz metin", "resim degil"],
  ])("%s uzantısı .png olsa da REDDEDİLİR", async (_ad, icerik) => {
    const r = await yukle(icerik, "zararsiz.png");

    expect(r.durum).toBe(400);
    expect(saveMock, "resim olmayan dosya diske yazılmamalı").not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("boş dosya reddedilir", async () => {
    const r = await yukle("");
    expect(r.durum).toBe(400);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("dosya alanı yoksa 400", async () => {
    const r = await POST(
      new Request("http://t", { method: "POST", body: new FormData() }),
    );
    expect(r.status).toBe(400);
  });
});

describe("POST — eski dosyanın temizlenmesi", () => {
  it("önceki fotoğraf silinir", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ avatarFile: "eski.png" });

    await yukle(PNG);

    expect(deleteMock).toHaveBeenCalledWith("eski.png");
  });

  it("eski dosya silinemese de yükleme BAŞARILI sayılır", async () => {
    // Kullanıcı fotoğrafsız kalmamalı; artık dosya kalması kabul edilebilir.
    prismaMock.user.findUnique.mockResolvedValue({ avatarFile: "eski.png" });
    deleteMock.mockRejectedValue(new Error("silinemedi"));

    const r = await yukle(PNG);

    expect(r.durum).toBe(200);
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it("depolama yazamazsa DB GÜNCELLENMEZ", async () => {
    // Aksi halde DB var olmayan bir dosyayı işaret ederdi.
    saveMock.mockRejectedValue(new Error("disk dolu"));

    const r = await yukle(PNG);

    expect(r.durum).toBe(500);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("POST — oran sınırı", () => {
  it("aşılınca 429 döner ve dosya yazılmaz", async () => {
    limitMock.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });

    const r = await POST(istek(PNG));

    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("30");
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("sınır kullanıcı başına uygulanır", async () => {
    await yukle(PNG);
    expect(limitMock).toHaveBeenCalledWith("k1");
  });
});

describe("DELETE", () => {
  it("fotoğraf kaldırılır", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ avatarFile: "var.png" });

    const r = await DELETE();

    expect(r.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "k1" },
      data: { avatarFile: null },
    });
    expect(deleteMock).toHaveBeenCalledWith("var.png");
  });

  it("fotoğrafı olmayan kullanıcıda dosya silmeye çalışılmaz", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ avatarFile: null });

    await DELETE();

    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("oturum yoksa reddedilir", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    expect((await DELETE()).status).toBe(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
