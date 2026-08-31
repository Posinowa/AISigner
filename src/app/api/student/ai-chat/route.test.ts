import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCounter, resetCounters } from "@/lib/metrics";

// --- Bağımlılıkları mock'la ---
const { requireAuthMock, prismaMock, getTextModelMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { studentProfile: { findUnique: vi.fn() } },
  getTextModelMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/gemini-client", () => ({ getTextModel: getTextModelMock }));
// logger gerçek — sadece konsola yazıyor; metrics de gerçek (resetCounters ile sıfırlıyoruz).

import { POST } from "./route";

let userSeq = 0;
function authAsStudent() {
  // Her test farklı userId → rate-limit testleri etkilemesin.
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: `student-${userSeq++}`, role: "STUDENT" } },
  });
}

function makeRequest(message: string) {
  return new Request("http://test/api/student/ai-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

/** startChat'i taklit eden, sendMessage'i verilen davranışla çalışan model. */
function fakeModel(sendMessageImpl: () => unknown) {
  const startChat = vi.fn(() => ({ sendMessage: vi.fn(sendMessageImpl) }));
  return { model: { startChat }, startChat };
}

describe("POST /api/student/ai-chat — fallback + telemetry (#51/#70/#71)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCounters();
    prismaMock.studentProfile.findUnique.mockResolvedValue(null);
  });

  it("AI çağrısı patlarsa 500 değil 200 + dostça fallback reply döner", async () => {
    authAsStudent();
    getTextModelMock.mockImplementation(() => {
      throw new Error("Vertex AI unavailable");
    });

    const res = await POST(makeRequest("merhaba"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reply).toBeTypeOf("string");
    expect(json.reply.length).toBeGreaterThan(0);
    expect(json.error).toBeUndefined();
  });

  it("fallback servis edilince ai_chat.fallback sayacı artar, başarıda artmaz", async () => {
    // 1) Başarısız çağrı → fallback
    authAsStudent();
    getTextModelMock.mockImplementationOnce(() => {
      throw new Error("down");
    });
    await POST(makeRequest("soru 1"));

    expect(getCounter("ai_chat.attempt")).toBe(1);
    expect(getCounter("ai_chat.fallback")).toBe(1);

    // 2) Başarılı çağrı → fallback artmaz, attempt artar
    authAsStudent();
    const { model } = fakeModel(() => ({
      text: "İşte yönlendirme...",
    }));
    getTextModelMock.mockReturnValue(model);
    const res = await POST(makeRequest("soru 2"));
    const json = await res.json();

    expect(json.reply).toBe("İşte yönlendirme...");
    expect(getCounter("ai_chat.attempt")).toBe(2);
    expect(getCounter("ai_chat.fallback")).toBe(1); // değişmedi
  });

  it("guidance-only sistem promptu modele gerçekten gönderilir (regresyon koruması)", async () => {
    authAsStudent();
    const { model, startChat } = fakeModel(() => ({
      text: "ok",
    }));
    getTextModelMock.mockReturnValue(model);

    await POST(makeRequest("ödevimi sen yaz"));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = startChat.mock.calls as any[];
    const history = calls[0]?.[0]?.history ?? [];
    const systemText: string = history[0]?.parts?.[0]?.text ?? "";
    const introText: string = history[1]?.parts?.[0]?.text ?? "";

    // Sistem promptu "yerine iş yapma / tam çözüm üretme" kısıtını içermeli
    expect(systemText).toContain("REHBERLİK");
    expect(systemText.toLowerCase()).toContain("tam çözüm");
    // Intro mesajı ödevi yapmayacağını belli etmeli
    expect(introText.toLowerCase()).toContain("ödevini yapmam");
  });

  it("boş mesaj → 400 (AI çağrısına gitmez)", async () => {
    authAsStudent();
    const res = await POST(makeRequest("   "));
    expect(res.status).toBe(400);
    expect(getCounter("ai_chat.attempt")).toBe(0);
  });
});
