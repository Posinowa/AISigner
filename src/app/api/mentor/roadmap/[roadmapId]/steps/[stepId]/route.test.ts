import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, yenidenNumaralandirMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmap: { findUnique: vi.fn() },
    roadmapStep: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  yenidenNumaralandirMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/roadmap/server/siralama", () => ({
  yenidenNumaralandir: (...a: unknown[]) => yenidenNumaralandirMock(...a),
}));

import { PUT, DELETE } from "./route";

function mentor(id: string) {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "MENTOR" } } });
}
const params = (roadmapId = "rm-1", stepId = "s-1") => Promise.resolve({ roadmapId, stepId });
function roadmap(mentorId: string | null) {
  // #195: M:N — mentorId varsa tek elemanlı atama listesi, yoksa boş.
  return {
    id: "rm-1",
    assignedProject: {
      studentProfile: { mentorAssignments: mentorId ? [{ mentorId }] : [] },
    },
  };
}
function putReq(body: unknown) {
  return new Request("http://t", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function delReq(force = false) {
  return new Request(`http://t/api/mentor/roadmap/rm-1/steps/s-1${force ? "?force=true" : ""}`, {
    method: "DELETE",
  });
}

describe("mentor step PUT/DELETE — sahiplik + force (#184)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.roadmapStep.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.roadmapStep.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.roadmapStep.findFirst.mockResolvedValue({ id: "s-1", status: "TODO" });
  });

  // ---- PUT ----
  it("PUT: başka mentörün adımı → 403, güncelleme YOK", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("baska-mentor"));
    const res = await PUT(putReq({ title: "Yeni" }), { params: params() });
    expect(res.status).toBe(403);
    expect(prismaMock.roadmapStep.updateMany).not.toHaveBeenCalled();
  });

  it("PUT: roadmap yok → 404", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(null);
    const res = await PUT(putReq({ title: "Yeni" }), { params: params() });
    expect(res.status).toBe(404);
  });

  it("PUT: kendi öğrencisinin adımı → 200, güncellenir", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    const res = await PUT(putReq({ title: "Güncel Başlık" }), { params: params() });
    expect(res.status).toBe(200);
    expect(prismaMock.roadmapStep.updateMany).toHaveBeenCalled();
  });

  // ---- DELETE ----
  it("DELETE: başka mentörün adımı → 403, silme YOK", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("baska-mentor"));
    const res = await DELETE(delReq(), { params: params() });
    expect(res.status).toBe(403);
    expect(prismaMock.roadmapStep.deleteMany).not.toHaveBeenCalled();
  });

  it("DELETE: TODO adım → silinir", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    prismaMock.roadmapStep.findFirst.mockResolvedValue({ status: "TODO" });
    const res = await DELETE(delReq(), { params: params() });
    expect(res.status).toBe(200);
    // #411: silme artık roadmapId ile de daraltılıyor.
    expect(prismaMock.roadmapStep.deleteMany).toHaveBeenCalledWith({
      where: { id: "s-1", roadmapId: "rm-1" },
    });
  });

  it("DELETE: aktif adım (IN_PROGRESS) force'suz → 409, silme YOK (öğrenci ilerlemesi)", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    prismaMock.roadmapStep.findFirst.mockResolvedValue({ status: "IN_PROGRESS" });
    const res = await DELETE(delReq(false), { params: params() });
    expect(res.status).toBe(409);
    expect(prismaMock.roadmapStep.deleteMany).not.toHaveBeenCalled();
  });

  it("DELETE: aktif adım + force=true → silinir", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    prismaMock.roadmapStep.findFirst.mockResolvedValue({ status: "IN_PROGRESS" });
    const res = await DELETE(delReq(true), { params: params() });
    expect(res.status).toBe(200);
    expect(prismaMock.roadmapStep.deleteMany).toHaveBeenCalled();
  });
});

/**
 * #411: Adımın URL'deki yol haritasına AİT OLDUĞU doğrulanmalı.
 *
 * Yetki `roadmapId` üzerinde kuruluyordu ama işlem `where: { id: stepId }` ile
 * yapılıyordu. Mentör kendi yol haritasının kimliğini URL'e koyup BAŞKA bir
 * stajyerin adımının kimliğini vererek o adımı düzenleyebiliyor ve
 * silebiliyordu. Canlı olarak doğrulandı: PUT 200 dönüp kurbanın başlığını
 * değiştiriyor, DELETE kurbanın adımını silip SALDIRGANIN yol haritasını
 * yeniden numaralandırıyordu.
 */
describe("adım/yol haritası bağı (#411)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    prismaMock.roadmapStep.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.roadmapStep.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.roadmapStep.findFirst.mockResolvedValue({ id: "s-1", status: "TODO" });
  });

  it("⚠️ PUT: güncelleme roadmapId İLE DE daraltılır", async () => {
    await PUT(putReq({ title: "Yeni" }), { params: params() });

    const arg = prismaMock.roadmapStep.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "s-1", roadmapId: "rm-1" });
  });

  it("⚠️ PUT: başka yol haritasının adımı → 404, geri okuma yapılmaz", async () => {
    prismaMock.roadmapStep.updateMany.mockResolvedValue({ count: 0 });

    const res = await PUT(putReq({ title: "ELE GEÇİRİLDİ" }), { params: params() });

    expect(res.status).toBe(404);
    // Adımın varlığı sızmasın.
    expect(prismaMock.roadmapStep.findFirst).not.toHaveBeenCalled();
  });

  it("PUT: status alanı mentör tarafından yazılamaz", async () => {
    await PUT(putReq({ title: "Yeni", status: "COMPLETED" }), { params: params() });

    const arg = prismaMock.roadmapStep.updateMany.mock.calls[0][0];
    expect(arg.data.status).toBeUndefined();
  });

  it("⚠️ PUT: order da yazılamaz — sıra yalnız reorder ucundan (#406)", async () => {
    await PUT(putReq({ title: "Yeni", order: 99 }), { params: params() });

    const arg = prismaMock.roadmapStep.updateMany.mock.calls[0][0];
    expect(arg.data.order).toBeUndefined();
  });

  it("PUT: yazılacak alan kalmadıysa güncelleme ÇAĞIRILMAZ, adım döner", async () => {
    // Gövde yalnız status/order içeriyorsa ikisi de çıkarılıyor ve safeData
    // boş kalıyor. Prisma boş data ile count 0 döndürüyor; körlemesine 404
    // demek VAR OLAN bir adım için yanıltıcı olurdu. Canlı testte bulundu.
    const res = await PUT(putReq({ order: 99, status: "COMPLETED" }), { params: params() });

    expect(res.status).toBe(200);
    expect(prismaMock.roadmapStep.updateMany).not.toHaveBeenCalled();
    // Okuma da roadmapId ile daraltılmış olmalı.
    expect(prismaMock.roadmapStep.findFirst.mock.calls[0][0].where).toEqual({
      id: "s-1",
      roadmapId: "rm-1",
    });
  });

  it("PUT: boş gövde + başka yol haritasının adımı → 404", async () => {
    prismaMock.roadmapStep.findFirst.mockResolvedValue(null);

    const res = await PUT(putReq({ order: 99 }), { params: params() });

    expect(res.status).toBe(404);
    expect(prismaMock.roadmapStep.updateMany).not.toHaveBeenCalled();
  });

  it("⚠️ DELETE: arama roadmapId İLE DE daraltılır", async () => {
    await DELETE(delReq(), { params: params() });

    const arg = prismaMock.roadmapStep.findFirst.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "s-1", roadmapId: "rm-1" });
  });

  it("⚠️ DELETE: başka yol haritasının adımı → 404, SİLME ve YENİDEN NUMARALANDIRMA YOK", async () => {
    prismaMock.roadmapStep.findFirst.mockResolvedValue(null);

    const res = await DELETE(delReq(), { params: params() });

    expect(res.status).toBe(404);
    expect(prismaMock.roadmapStep.deleteMany).not.toHaveBeenCalled();
    // Asıl hasar buydu: adım birinden siliniyor, DİĞERİ yeniden numaralanıyordu.
    expect(yenidenNumaralandirMock).not.toHaveBeenCalled();
  });

  it("DELETE: silme sonrası SADECE bu yol haritası yeniden numaralanır", async () => {
    await DELETE(delReq(), { params: params() });
    expect(yenidenNumaralandirMock).toHaveBeenCalledWith("rm-1");
  });

  it("DELETE: silme yarışı kaybedilirse (count 0) sıraya dokunulmaz", async () => {
    prismaMock.roadmapStep.deleteMany.mockResolvedValue({ count: 0 });

    const res = await DELETE(delReq(), { params: params() });

    expect(res.status).toBe(404);
    expect(yenidenNumaralandirMock).not.toHaveBeenCalled();
  });
});
