import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, hashMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    securityAnswer: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  },
  hashMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@node-rs/argon2", () => ({ hash: (...a: unknown[]) => hashMock(...a) }));

import { GET, POST } from "./route";

function authAs(id: string) {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "STUDENT" } } });
}
function postReq(body: unknown) {
  return new Request("http://t", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const threeValid = [
  { questionId: 0, answer: "tekir" },
  { questionId: 1, answer: "istanbul" },
  { questionId: 2, answer: "yilmaz" },
];

describe("security-questions (#187)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashMock.mockResolvedValue("HASHED");
    prismaMock.securityAnswer.deleteMany.mockResolvedValue({});
    prismaMock.securityAnswer.createMany.mockResolvedValue({});
  });

  it("GET yetkisiz → 403", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET: yalnızca kendi userId'siyle sorgular, isSetup döner", async () => {
    authAs("user-1");
    prismaMock.securityAnswer.findMany.mockResolvedValue([{ questionId: 0 }, { questionId: 1 }, { questionId: 2 }]);
    const json = await (await GET()).json();
    expect(prismaMock.securityAnswer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(json.isSetup).toBe(true);
  });

  it("POST: 3'ten az cevap → 400, yazma yok", async () => {
    authAs("user-1");
    const res = await POST(postReq({ answers: [{ questionId: 0, answer: "tekir" }] }));
    expect(res.status).toBe(400);
    expect(prismaMock.securityAnswer.createMany).not.toHaveBeenCalled();
  });

  it("POST: geçersiz soru numarası → 400", async () => {
    authAs("user-1");
    const res = await POST(postReq({ answers: [...threeValid, { questionId: 999, answer: "xx" }] }));
    expect(res.status).toBe(400);
  });

  it("POST: çok kısa cevap → 400", async () => {
    authAs("user-1");
    const res = await POST(postReq({ answers: [{ questionId: 0, answer: "a" }, { questionId: 1, answer: "b" }, { questionId: 2, answer: "c" }] }));
    expect(res.status).toBe(400);
  });

  it("POST geçerli: cevaplar HASH'lenir ve userId oturumdan alınır (düz metin saklanmaz)", async () => {
    authAs("user-1");
    const res = await POST(postReq({ answers: threeValid }));
    expect(res.status).toBe(200);
    // argon2 her cevap için çağrıldı
    expect(hashMock).toHaveBeenCalledTimes(3);
    // önce eskiler silinir (yalnız kendi userId)
    expect(prismaMock.securityAnswer.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    // kaydedilen veride düz cevap YOK, hash var; userId oturumdan
    const created = prismaMock.securityAnswer.createMany.mock.calls[0][0].data;
    expect(created.every((r: { userId: string; answer: string }) => r.userId === "user-1")).toBe(true);
    expect(created.every((r: { answer: string }) => r.answer === "HASHED")).toBe(true);
    expect(JSON.stringify(created)).not.toContain("tekir");
  });
});
