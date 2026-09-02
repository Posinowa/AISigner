import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCounter, resetCounters } from "@/lib/metrics";

// --- Bağımlılıkları mock'la ---
const { requireAuthMock, prismaMock, getTextModelMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    studentProfile: { findUnique: vi.fn() },
    // #321: riza kontrolu User.aiConsentAt okuyor.
    user: { findUnique: vi.fn() },
  },
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
    // #321: Varsayilan olarak riza VAR — mevcut testler AI davranisini olcuyor.
    prismaMock.user.findUnique.mockResolvedValue({ aiConsentAt: new Date() });
  });

  // #321 KVKK: riza yoksa mesaj Vertex AI'ya (ABD) GONDERILMEZ.
  it("KVKK rızası yoksa 403 döner ve AI'ya HİÇ gidilmez", async () => {
    authAsStudent();
    prismaMock.user.findUnique.mockResolvedValue({ aiConsentAt: null });

    const res = await POST(
      new Request("http://t", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "merhaba" }),
      }),
    );

    expect(res.status).toBe(403);
    expect((await res.json()).rizaGerekli).toBe(true);
    // Kritik: model hiç kurulmamali — veri yurt disina cikmamali.
    expect(getTextModelMock).not.toHaveBeenCalled();
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

/**
 * #376 — POSİLOG TAKIM PROJELERİNDEN HABERSİZDİ.
 *
 * Takım atamasında `AssignedProject.studentProfileId` NULL, sahiplik `teamId`
 * üzerinde (#332). Yalnız `assignedProjects` çekildiği için takım projesindeki
 * stajyer Posilog'a sorduğunda, Posilog HİÇ projesi yokmuş gibi cevap
 * veriyordu. Öğrenci panosunda #367 ile çözülen ayrım bu uca yansımamıştı.
 */
describe("takım projeleri bağlama girer (#376)", () => {
  const profil = (ekle: Record<string, unknown>) => ({
    experienceLevel: "BEGINNER",
    interests: ["React"],
    goals: "hedef",
    assignedProjects: [],
    teamMemberships: [],
    ...ekle,
  });

  const atama = (baslik: string) => ({
    projectTemplate: { title: baslik, track: ["Next.js"], difficulty: "MEDIUM" },
    roadmap: {
      steps: [
        { title: "Adim 1", status: "COMPLETED", order: 1 },
        { title: "Adim 2", status: "IN_PROGRESS", order: 2 },
      ],
    },
  });

  /** Modele giden sistem talimatı + bağlam metni. */
  function baglamMetni(startChat: { mock: { calls: unknown[][] } }) {
    return JSON.stringify(startChat.mock.calls[0][0]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    resetCounters();
    authAsStudent();
    prismaMock.user.findUnique.mockResolvedValue({ aiConsentAt: new Date() });
  });

  it("sorgu HEM bireysel HEM takım atamalarını ister", async () => {
    const { model } = fakeModel(() => ({ response: { text: () => "ok" } }));
    getTextModelMock.mockReturnValue(model);
    prismaMock.studentProfile.findUnique.mockResolvedValue(profil({}));

    await POST(makeRequest("merhaba"));

    const dahil = prismaMock.studentProfile.findUnique.mock.calls[0][0].include;
    expect(dahil.assignedProjects).toBeDefined();
    expect(dahil.teamMemberships).toBeDefined();
    // Ayrılmış üyenin projesi artık onun işi değil.
    expect(dahil.teamMemberships.where.leftAt).toBeNull();
    expect(dahil.teamMemberships.select.team.select.assignedProjects).toBeDefined();
  });

  it("SADECE takım projesi olan stajyerde proje bağlama girer", async () => {
    const { model, startChat } = fakeModel(() => ({ response: { text: () => "ok" } }));
    getTextModelMock.mockReturnValue(model);
    prismaMock.studentProfile.findUnique.mockResolvedValue(
      profil({
        teamMemberships: [
          { team: { name: "Takim A", assignedProjects: [atama("Takim Projesi")] } },
        ],
      }),
    );

    await POST(makeRequest("projemde ne yapmaliyim"));

    const metin = baglamMetni(startChat);
    expect(metin).toContain("Aktif Projeler");
    expect(metin).toContain("Takim Projesi");
    // Ortak panoda "şu anki adım" başkasının üstlendiği iş olabilir; model
    // bunu bireysel bir görev gibi sunmasın diye takım adı yazılıyor.
    expect(metin).toContain("Takim A");
  });

  it("bireysel atamada REGRESYON yok", async () => {
    const { model, startChat } = fakeModel(() => ({ response: { text: () => "ok" } }));
    getTextModelMock.mockReturnValue(model);
    prismaMock.studentProfile.findUnique.mockResolvedValue(
      profil({ assignedProjects: [atama("Bireysel Proje")] }),
    );

    await POST(makeRequest("merhaba"));

    expect(baglamMetni(startChat)).toContain("Bireysel Proje");
  });

  it("hiç projesi olmayan stajyerde 'Aktif Projeler' yazılmaz", async () => {
    const { model, startChat } = fakeModel(() => ({ response: { text: () => "ok" } }));
    getTextModelMock.mockReturnValue(model);
    prismaMock.studentProfile.findUnique.mockResolvedValue(profil({}));

    await POST(makeRequest("merhaba"));

    expect(baglamMetni(startChat)).not.toContain("Aktif Projeler");
  });
});
