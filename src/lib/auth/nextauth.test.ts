import { describe, it, expect, beforeEach, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import type { User } from "next-auth";

// jwt callback'i @/lib/auth/prisma üzerinden DB'ye gider — onu mock'luyoruz.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth/prisma", () => ({ prisma: prismaMock }));

import { authOptions } from "@/lib/auth/nextauth";

// callback'leri tipli erişim için kısayol
const jwt = authOptions.callbacks!.jwt!;

/** Sonraki istekleri taklit eder: user yok, token elde. */
function callJwt(token: JWT) {
  return jwt({ token, user: undefined as unknown as User } as Parameters<typeof jwt>[0]);
}

describe("authOptions.callbacks.jwt — rol/durum tazeleme (#44/#68)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ilk girişte (user verilince) token'ı doldurur ve DB'ye gitmez", async () => {
    const token = await jwt({
      token: {} as JWT,
      user: { id: "u1", email: "a@b.com", role: "MENTOR", accountStatus: "APPROVED" } as User,
    } as Parameters<typeof jwt>[0]);

    expect(token.id).toBe("u1");
    expect(token.role).toBe("MENTOR");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("sonraki istekte DB'deki güncel rolü token'a yansıtır (downgrade MENTOR→STUDENT)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT", accountStatus: "APPROVED" });

    const token = await callJwt({ id: "u1", role: "MENTOR", accountStatus: "APPROVED" } as JWT);

    expect(prismaMock.user.findUnique).toHaveBeenCalledOnce();
    expect(token.role).toBe("STUDENT");
    expect(token.accountStatus).toBe("APPROVED");
  });

  it("hesap reddedilince (APPROVED→REJECTED) accountStatus token'a yansır", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT", accountStatus: "REJECTED" });

    const token = await callJwt({ id: "u1", role: "STUDENT", accountStatus: "APPROVED" } as JWT);

    expect(token.accountStatus).toBe("REJECTED");
  });

  it("DB hatasında mevcut token korunur (oturum bozulmaz)", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("db down"));

    const token = await callJwt({ id: "u1", role: "MENTOR", accountStatus: "APPROVED" } as JWT);

    // Hata yutulur, eski değerler korunur
    expect(token.role).toBe("MENTOR");
    expect(token.accountStatus).toBe("APPROVED");
  });

  it("kullanıcı silinmişse (DB null) yetki kaldırılır", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const token = await callJwt({ id: "u1", role: "MENTOR", accountStatus: "APPROVED" } as JWT);

    expect(token.role).toBeUndefined();
    expect(token.accountStatus).toBeUndefined();
  });
});
