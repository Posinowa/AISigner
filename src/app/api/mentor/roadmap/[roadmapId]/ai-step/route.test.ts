import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, getModelMock, loggerMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    roadmap: { findUnique: vi.fn() },
    roadmapStep: { create: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  },
  getModelMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/gemini-client", () => ({ getModel: (...a: unknown[]) => getModelMock(...a) }));

import { POST } from "./route";

const ctx = { params: Promise.resolve({ roadmapId: "r-1" }) };
function req(body: unknown = {}) {
  return new Request("http://test/api/mentor/roadmap/r-1/ai-step", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("mentor ai-step route — yetki (#178-3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("MENTOR rolü zorunlu — guard'a geçirilir", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(requireAuthMock).toHaveBeenCalledWith("MENTOR");
    expect(prismaMock.roadmap.findUnique).not.toHaveBeenCalled();
  });

  it("roadmap yoksa 404", async () => {
    requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "m", role: "MENTOR" } } });
    prismaMock.roadmap.findUnique.mockResolvedValue(null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
  });
});

/**
 * #377 — ai-step ARTIK `cozVeDogrula`'DAN GEÇİYOR.
 *
 * Öncesinde elle ```json temizliği vardı ve tip yalnızca varsayılıyordu.
 * Buradaki sürüm `cozVeDogrula`'dan DAHA ZAYIFTI: modelin JSON'un başına
 * eklediği açıklama metnini ayıklamıyordu, o durumda `JSON.parse` patlayıp
 * akış SESSİZCE fallback adıma düşüyordu — mentör uydurma bir adım alıyor,
 * bunu gerçek AI çıktısından ayırt edemiyordu.
 */
describe("model çıktısı çözümleme (#377)", () => {
  const ADIM = {
    title: "Kimlik doğrulama katmanı",
    description: "NextAuth ile oturum akışını kur.",
    estimatedHours: 5,
    resources: ["https://next-auth.js.org"],
  };

  function modelDondursun(text: string) {
    getModelMock.mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({ text }),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "m", role: "MENTOR" } },
    });
    prismaMock.roadmap.findUnique.mockResolvedValue({
      id: "r-1",
      steps: [],
      assignedProject: {
        studentProfile: {
          userId: "o-1",
          experienceLevel: "BEGINNER",
          interests: [],
          // Prompt öğrenci adını kullanıyor; eksik bırakmak sessizce
          // fallback'e düşürüyordu.
          user: { name: "Ogrenci" },
          mentorAssignments: [{ mentorId: "m" }],
        },
        team: null,
        projectTemplate: { title: "Proje", description: "aciklama" },
      },
    });
    prismaMock.roadmapStep.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: "st-1", ...data }),
    );
  });

  it("⚠️ ```json BLOĞUNA sarılı çıktı çözülür", async () => {
    modelDondursun(["```json", JSON.stringify(ADIM), "```"].join("\n"));

    const res = await POST(req({ prompt: "auth" }), ctx);
    const veri = await res.json();

    expect(res.status).toBe(200);
    expect(veri.step.title).toBe(ADIM.title);
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });

  it("⚠️ BAŞINA AÇIKLAMA eklenmiş çıktı çözülür — eski regex bunu ayıklamıyordu", async () => {
    modelDondursun("Tabii, işte adım:" + "\n\n" + JSON.stringify(ADIM));

    const res = await POST(req({ prompt: "auth" }), ctx);
    const veri = await res.json();

    expect(veri.step.title).toBe(ADIM.title);
  });

  it("eksik alanlarda fallback DEĞERLER kullanılır", async () => {
    modelDondursun(JSON.stringify({ title: "Sadece baslik", description: "aciklama" }));

    const res = await POST(req({ prompt: "x" }), ctx);
    const veri = await res.json();

    expect(veri.step.estimatedHours).toBe(3);
    expect(veri.step.resources.length).toBeGreaterThan(0);
  });

  it("ŞEMAYA uymayan çıktıda fallback adım üretilir VE loglanır", async () => {
    // `description` yok — eski sürüm bunu sessizce atlıyordu.
    modelDondursun(JSON.stringify({ title: "eksik" }));

    const res = await POST(req({ prompt: "x" }), ctx);
    const veri = await res.json();

    expect(res.status).toBe(200);
    expect(veri.step.title).not.toBe("eksik");
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  it("bozuk JSON'da fallback adım üretilir VE loglanır", async () => {
    modelDondursun("{bu json degil");

    const res = await POST(req({ prompt: "x" }), ctx);

    expect(res.status).toBe(200);
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});
