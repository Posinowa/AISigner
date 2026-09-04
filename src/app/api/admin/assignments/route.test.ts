import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, progressMock, baslatMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  progressMock: vi.fn(),
  baslatMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/features/admin/server/assignment-progress", () => ({
  getStudentAssignmentsProgress: (...a: unknown[]) => progressMock(...a),
}));
vi.mock("@/features/github/server/provisioning", () => ({
  baslatGitHubWorkspaceKurulumu: (...a: unknown[]) => baslatMock(...a),
}));

/** Kurulum ikinci argümanla ayrılıyor: true = güncelleme, false = ilk kurulum. */
const guncellemeOlarakCagrildi = () =>
  baslatMock.mock.calls.some(([, guncelleme]) => guncelleme === true);
const kurulumOlarakCagrildi = () =>
  baslatMock.mock.calls.some(([, guncelleme]) => guncelleme === false);

import { GET, POST } from "./route";

function admin() {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id: "admin-1", role: "ADMIN" } } });
}
function forbidden() {
  requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(JSON.stringify({ error: "x" }), { status: 403 }) });
}
/** #452: GET artık sorgu parametresi okuyor — istek nesnesi şart. */
function getReq(qs = "") {
  return new Request(`http://test/api/admin/assignments${qs}`);
}
const SAYFA = { atamalar: [], nextCursor: null, sayaclar: { toplam: 0, kurulu: 0, kurulmamis: 0, ortalamaIlerleme: 0 } };

function postReq(body: unknown) {
  return new Request("http://test/api/admin/assignments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin/assignments route (#178-3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET admin değil → 403, veri çekilmez", async () => {
    forbidden();
    const res = await GET(getReq());
    expect(res.status).toBe(403);
    expect(progressMock).not.toHaveBeenCalled();
  });

  it("GET admin → 200 ve ilerleme verisi döner", async () => {
    admin();
    progressMock.mockResolvedValue(SAYFA);
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect(progressMock).toHaveBeenCalled();
  });

  /**
   * #452 — Süzme ve sayfalama SUNUCUDA.
   *
   * ⚠️ Bu testler bir sözleşme değişikliğini koruyor ve o değişikliği ne tip
   * sistemi ne de mevcut testler yakalamıştı: rota `NextResponse.json(data)`
   * dediği, sayfa da `res.json()`'u tipsiz aldığı için dönüş şekli diziden
   * nesneye geçtiğinde HİÇBİR ŞEY uyarmadı. Parametrelerin gerçekten
   * geçtiğini burada kilitliyoruz.
   */
  it("GET süzme ve sayfalama parametrelerini sunucuya geçirir", async () => {
    admin();
    progressMock.mockResolvedValue(SAYFA);
    await GET(getReq("?durum=PROVISIONED&mentor=m1&cursor=c9&limit=25"));
    expect(progressMock).toHaveBeenCalledWith({
      githubDurum: "PROVISIONED",
      mentorId: "m1",
      cursor: "c9",
      limit: 25,
    });
  });

  it("⚠️ tanınmayan durum sessizce ALL'a düşer — yazım hatası listeyi boşaltmasın", async () => {
    admin();
    progressMock.mockResolvedValue(SAYFA);
    await GET(getReq("?durum=SAÇMA"));
    expect(progressMock.mock.calls[0][0].githubDurum).toBe("ALL");
  });

  it("parametre yoksa süzme uygulanmaz", async () => {
    admin();
    progressMock.mockResolvedValue(SAYFA);
    await GET(getReq());
    const arg = progressMock.mock.calls[0][0];
    expect(arg.githubDurum).toBe("ALL");
    expect(arg.mentorId).toBeNull();
    expect(arg.cursor).toBeNull();
    expect(arg.limit).toBeUndefined();
  });

  it("geçersiz limit yok sayılır — sunucudaki varsayılan korunur", async () => {
    admin();
    progressMock.mockResolvedValue(SAYFA);
    await GET(getReq("?limit=abc"));
    expect(progressMock.mock.calls[0][0].limit).toBeUndefined();
  });

  it("POST admin değil → 403, provisioning çağrılmaz", async () => {
    forbidden();
    const res = await POST(postReq({ assignmentId: "a1" }));
    expect(res.status).toBe(403);
    expect(baslatMock).not.toHaveBeenCalled();
  });

  it("POST geçersiz assignmentId → 400, provisioning çağrılmaz", async () => {
    admin();
    const res = await POST(postReq({ assignmentId: 123 }));
    expect(res.status).toBe(400);
    expect(baslatMock).not.toHaveBeenCalled();
  });

  it("POST geçerli → kurulum BAŞLATILIR ve 202 döner", async () => {
    admin();
    baslatMock.mockResolvedValue({ started: true, simulated: true, guncelleme: false, message: "ok" });

    const res = await POST(postReq({ assignmentId: "a1" }));

    // 202: iş kabul edildi ama BİTMEDİ. Uç artık kurulumu beklemiyor —
    // beklemek platformun istek zaman aşımına çarpma riski taşıyordu.
    expect(res.status).toBe(202);
    expect(baslatMock).toHaveBeenCalledWith("a1", false);
    expect((await res.json()).started).toBe(true);
  });
});

/**
 * #257 — aynı uç hem kurulum hem güncelleme yapıyor; ayrım gövdeden geliyor.
 */
describe("assignments POST — güncelleme ayrımı (#257)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "a", role: "ADMIN" } },
    });
    baslatMock.mockResolvedValue({ started: true, simulated: true, guncelleme: false, message: "ok" });
  });

  const istek = (govde: unknown) =>
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(govde),
    });

  it("guncelle:true güncelleme akışını çağırır", async () => {
    await POST(istek({ assignmentId: "ap-1", guncelle: true }));

    expect(baslatMock).toHaveBeenCalledWith("ap-1", true);
    expect(kurulumOlarakCagrildi(), "güncellemede ilk kurulum çağrılmamalı").toBe(false);
  });

  it("guncelle yoksa ilk kurulum çağrılır", async () => {
    await POST(istek({ assignmentId: "ap-1" }));

    expect(baslatMock).toHaveBeenCalledWith("ap-1", false);
    expect(guncellemeOlarakCagrildi()).toBe(false);
  });

  it.each([false, "true", 1, null])(
    "guncelle=%s kesin true değilse kurulum çağrılır",
    async (deger) => {
      // Gevşek doğruluk kontrolü kurulu bir alanı yanlışlıkla sıfırlayabilirdi.
      await POST(istek({ assignmentId: "ap-1", guncelle: deger }));
      expect(kurulumOlarakCagrildi()).toBe(true);
      expect(guncellemeOlarakCagrildi()).toBe(false);
    },
  );
});
