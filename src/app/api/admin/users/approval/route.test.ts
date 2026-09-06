import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, updateStatusMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  updateStatusMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/admin/server/user", () => ({
  updateAccountStatus: (...a: unknown[]) => updateStatusMock(...a),
  // Route bu sınıfı `instanceof` ile ayırt ediyor; mock'ta da bulunmalı.
  AssignmentValidationError: class AssignmentValidationError extends Error {},
}));

import { POST } from "./route";
import { AssignmentValidationError } from "@/features/admin/server/user";

function admin(id = "admin-1") {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "ADMIN" } } });
}
function req(body: unknown) {
  return new Request("http://t", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin users approval (#187)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ADMIN değil → 403, güncelleme yok", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await POST(req({ userId: "u1", accountStatus: "APPROVED" }));
    expect(res.status).toBe(403);
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("geçersiz accountStatus → 400", async () => {
    admin();
    const res = await POST(req({ userId: "u1", accountStatus: "SILINDI" }));
    expect(res.status).toBe(400);
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("admin kendi hesabını değiştiremez → 403", async () => {
    admin("admin-1");
    const res = await POST(req({ userId: "admin-1", accountStatus: "REJECTED" }));
    expect(res.status).toBe(403);
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("geçerli → updateAccountStatus çağrılır", async () => {
    admin("admin-1");
    updateStatusMock.mockResolvedValue({ id: "u1", accountStatus: "APPROVED" });
    const res = await POST(req({ userId: "u1", accountStatus: "APPROVED" }));
    expect(res.status).toBe(200);
    expect(updateStatusMock).toHaveBeenCalledWith("u1", "APPROVED");
  });
});

describe("onay kapısı — doğrulanmamış e-posta (#5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("doğrulanmamış hesabı onaylamak 400 + anlamlı mesaj döner", async () => {
    admin();
    updateStatusMock.mockRejectedValue(
      new AssignmentValidationError("Bu hesabın e-posta adresi henüz doğrulanmamış."),
    );

    const res = await POST(req({ userId: "u1", accountStatus: "APPROVED" }));

    expect(res.status).toBe(400);
    // Mesaj admin'e aynen gösteriliyor (UI toast'ta yansıtıyor) — neden
    // onaylayamadığını anlaması gerek, genel bir "hata oluştu" yetmez.
    await expect(res.json()).resolves.toEqual({
      error: "Bu hesabın e-posta adresi henüz doğrulanmamış.",
    });
  });

  it("beklenmeyen hata 500 döner ve iç detayı SIZDIRMAZ", async () => {
    admin();
    updateStatusMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));

    const res = await POST(req({ userId: "u1", accountStatus: "APPROVED" }));

    expect(res.status).toBe(500);
    const govde = await res.json();
    expect(govde.error).not.toContain("ECONNREFUSED");
  });
});
