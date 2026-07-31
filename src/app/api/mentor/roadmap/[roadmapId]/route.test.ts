import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { roadmap: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET, PUT } from "./route";

function mentor(id: string) {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "MENTOR" } } });
}
const params = (roadmapId = "rm-1") => Promise.resolve({ roadmapId });
function putReq(body: unknown) {
  return new Request("http://t", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
/** Verilen mentöre ait roadmap. */
function roadmap(mentorId: string | null) {
  return {
    id: "rm-1",
    assignedProject: { studentProfile: { mentorId }, projectTemplate: {} },
    steps: [],
  };
}

describe("mentor roadmap GET/PUT — sahiplik (#184)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.roadmap.update.mockResolvedValue({ id: "rm-1", steps: [] });
  });

  it("MENTOR değil (guard) → 403", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await GET(new Request("http://t"), { params: params() });
    expect(res.status).toBe(403);
    expect(prismaMock.roadmap.findUnique).not.toHaveBeenCalled();
  });

  it("GET: roadmap yok → 404", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(null);
    const res = await GET(new Request("http://t"), { params: params() });
    expect(res.status).toBe(404);
  });

  it("GET: başka mentörün roadmap'i → 403", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("baska-mentor"));
    const res = await GET(new Request("http://t"), { params: params() });
    expect(res.status).toBe(403);
  });

  it("GET: kendi roadmap'i → 200", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    const res = await GET(new Request("http://t"), { params: params() });
    expect(res.status).toBe(200);
  });

  it("PUT: başka mentörün roadmap'i → 403, güncelleme YOK", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("baska-mentor"));
    const res = await PUT(putReq({ status: "PUBLISHED" }), { params: params() });
    expect(res.status).toBe(403);
    expect(prismaMock.roadmap.update).not.toHaveBeenCalled();
  });

  it("PUT: kendi roadmap'i → 200, güncellenir", async () => {
    mentor("mentor-1");
    prismaMock.roadmap.findUnique.mockResolvedValue(roadmap("mentor-1"));
    const res = await PUT(putReq({ status: "PUBLISHED" }), { params: params() });
    expect(res.status).toBe(200);
    expect(prismaMock.roadmap.update).toHaveBeenCalled();
  });

  it("PUT: geçersiz status (Zod) → 400", async () => {
    mentor("mentor-1");
    const res = await PUT(putReq({ status: "YAYINDA" }), { params: params() });
    expect(res.status).toBe(400);
  });
});
