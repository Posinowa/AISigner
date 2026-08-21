import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, updateMock, deleteMock, getMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  // #253: Rota artık sahiplik için şablonu okuyor.
  getMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/projects/server/templates", () => ({
  updateTemplate: (...a: unknown[]) => updateMock(...a),
  deleteTemplate: (...a: unknown[]) => deleteMock(...a),
  getTemplateById: (...a: unknown[]) => getMock(...a),
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Varsayılan: şablon var ve admin tarafından oluşturulmuş (sahipsiz).
    getMock.mockResolvedValue({ id: "tpl-1", createdById: null });
  });

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

/**
 * #253 — mentör kendi şablonunu yönetebilir, başkasınınkine dokunamaz.
 */
describe("project-template [id] — mentör sahipliği (#253)", () => {
  function mentor(id = "m1") {
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id, role: "MENTOR" } },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({ id: "tpl-1" });
    deleteMock.mockResolvedValue(undefined);
  });

  it("mentör KENDİ şablonunu güncelleyebilir", async () => {
    mentor("m1");
    getMock.mockResolvedValue({ id: "tpl-1", createdById: "m1" });

    const res = await PATCH(patchReq({ title: "Guncel" }), ctx());
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalled();
  });

  it("mentör BAŞKASININ şablonunu güncelleyemez", async () => {
    mentor("m2");
    getMock.mockResolvedValue({ id: "tpl-1", createdById: "m1" });

    const res = await PATCH(patchReq({ title: "Ele gecir" }), ctx());
    expect(res.status).toBe(403);
    expect(updateMock, "yetkisiz güncelleme DB'ye gitmemeli").not.toHaveBeenCalled();
  });

  it("mentör sahipsiz (eski) şablonu güncelleyemez", async () => {
    mentor("m1");
    getMock.mockResolvedValue({ id: "tpl-1", createdById: null });

    const res = await PATCH(patchReq({ title: "Eski" }), ctx());
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("mentör BAŞKASININ şablonunu silemez", async () => {
    mentor("m2");
    getMock.mockResolvedValue({ id: "tpl-1", createdById: "m1" });

    const res = await DELETE(new Request("http://t"), ctx());
    expect(res.status).toBe(403);
    expect(deleteMock, "yetkisiz silme DB'ye gitmemeli").not.toHaveBeenCalled();
  });

  it("mentör KENDİ şablonunu silebilir", async () => {
    mentor("m1");
    getMock.mockResolvedValue({ id: "tpl-1", createdById: "m1" });

    const res = await DELETE(new Request("http://t"), ctx());
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("tpl-1");
  });

  it("admin mentörün şablonunu yönetebilir", async () => {
    admin();
    getMock.mockResolvedValue({ id: "tpl-1", createdById: "m1" });

    expect((await PATCH(patchReq({ title: "Admin" }), ctx())).status).toBe(200);
  });

  it("olmayan şablon 404 döner", async () => {
    mentor("m1");
    getMock.mockResolvedValue(null);

    expect((await PATCH(patchReq({ title: "Yok" }), ctx())).status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sahip güncelleme gövdesiyle DEĞİŞTİRİLEMEZ", async () => {
    // Aksi halde mentör bir şablonun sahipliğini kendine geçirebilirdi.
    mentor("m1");
    getMock.mockResolvedValue({ id: "tpl-1", createdById: "m1" });

    await PATCH(patchReq({ title: "X", createdById: "m2" }), ctx());

    const gonderilen = updateMock.mock.calls[0]?.[1] ?? {};
    expect(gonderilen).not.toHaveProperty("createdById");
  });
});
