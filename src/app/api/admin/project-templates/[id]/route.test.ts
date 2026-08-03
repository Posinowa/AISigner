import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, updateMock, deleteMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/projects/server/templates", () => ({
  updateTemplate: (...a: unknown[]) => updateMock(...a),
  deleteTemplate: (...a: unknown[]) => deleteMock(...a),
}));

import { PATCH, DELETE } from "./route";

function admin() {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "admin-1", role: "ADMIN" } } });
}
const ctx = (id = "tpl-1") => ({ params: Promise.resolve({ id }) });
function patchReq(body: unknown) {
  return new Request("http://t", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin project-template [id] PATCH/DELETE (#187)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCH ADMIN değil → 403", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await PATCH(patchReq({ title: "Yeni" }), ctx());
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PATCH geçersiz gövde (boş title) → 400", async () => {
    admin();
    const res = await PATCH(patchReq({ title: "" }), ctx());
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PATCH başlık çakışması (DUPLICATE_TITLE) → 409", async () => {
    admin();
    updateMock.mockRejectedValue(Object.assign(new Error("dup"), { code: "DUPLICATE_TITLE" }));
    const res = await PATCH(patchReq({ title: "Var Olan" }), ctx());
    expect(res.status).toBe(409);
  });

  it("PATCH geçerli → 200", async () => {
    admin();
    updateMock.mockResolvedValue({ id: "tpl-1", title: "Yeni" });
    const res = await PATCH(patchReq({ title: "Yeni Başlık" }), ctx());
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("tpl-1", expect.objectContaining({ title: "Yeni Başlık" }));
  });

  it("DELETE ADMIN değil → 403", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await DELETE(new Request("http://t", { method: "DELETE" }), ctx());
    expect(res.status).toBe(403);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("DELETE ADMIN → siler", async () => {
    admin();
    deleteMock.mockResolvedValue({});
    const res = await DELETE(new Request("http://t", { method: "DELETE" }), ctx());
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("tpl-1");
  });
});
