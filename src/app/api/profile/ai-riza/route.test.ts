import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, ayarlaMock, varMock, silMock, uretMock, arkaPlanIsleri } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    ayarlaMock: vi.fn(),
    varMock: vi.fn(),
    silMock: vi.fn(),
    uretMock: vi.fn(),
    arkaPlanIsleri: [] as (() => unknown)[],
  }));

// #352: Rıza verildiğinde analiz üretimi `after()` ile arka plana atılıyor.
// `NextResponse` gerçek kalmalı, yoksa rota yanıt üretemez.
vi.mock("next/server", async () => {
  const gercek = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...gercek,
    after: (cb: () => unknown) => {
      arkaPlanIsleri.push(cb);
    },
  };
});
vi.mock("@/features/kvkk/riza-etkileri", () => ({
  rizaGeriAlindiginda: (...a: unknown[]) => silMock(...a),
  rizaVerildiginde: (...a: unknown[]) => uretMock(...a),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/kvkk/riza", () => ({
  aiRizasiniAyarla: (...a: unknown[]) => ayarlaMock(...a),
  aiRizasiVar: (...a: unknown[]) => varMock(...a),
}));

import { GET, POST } from "./route";

function oturum(id = "u1") {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id } } });
}
const istek = (govde: unknown) =>
  new Request("http://t", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(govde),
  });

beforeEach(() => {
  vi.clearAllMocks();
  arkaPlanIsleri.length = 0;
  silMock.mockResolvedValue(undefined);
  uretMock.mockResolvedValue(undefined);
  varMock.mockResolvedValue(false);
});

describe("GET /api/profile/ai-riza", () => {
  it("mevcut rıza durumunu döner", async () => {
    oturum();
    varMock.mockResolvedValue(true);

    expect(await (await GET()).json()).toEqual({ rizaVar: true });
  });

  it("yetkisizse DB'ye gidilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    expect((await GET()).status).toBe(401);
    expect(varMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/ai-riza", () => {
  it("rıza verir", async () => {
    oturum("u1");
    const res = await POST(istek({ rizaVar: true }));

    expect(res.status).toBe(200);
    expect(ayarlaMock).toHaveBeenCalledWith("u1", true);
  });

  it("rızayı GERİ ALIR (KVKK m.11)", async () => {
    oturum("u1");
    await POST(istek({ rizaVar: false }));

    expect(ayarlaMock).toHaveBeenCalledWith("u1", false);
  });

  it("boolean olmayan değer REDDEDİLİR", async () => {
    // "true" string'i rıza sayılsaydı, gevşek bir istemci kazara rıza üretebilirdi.
    oturum();
    const res = await POST(istek({ rizaVar: "true" }));

    expect(res.status).toBe(400);
    expect(ayarlaMock).not.toHaveBeenCalled();
  });

  it("rıza HER ZAMAN oturumdaki kullanıcıya yazılır — gövdedeki kimlik yok sayılır", async () => {
    // Aksi halde bir kullanıcı başkasının adına rıza üretebilirdi.
    oturum("gercek-kullanici");
    await POST(istek({ rizaVar: true, userId: "baskasi" }));

    expect(ayarlaMock).toHaveBeenCalledWith("gercek-kullanici", true);
  });

  it("bozuk JSON'da 400 döner", async () => {
    oturum();
    const res = await POST(
      new Request("http://t", { method: "POST", headers: { "content-type": "application/json" }, body: "{bozuk" }),
    );

    expect(res.status).toBe(400);
    expect(ayarlaMock).not.toHaveBeenCalled();
  });
});

/**
 * #352 — rıza değişikliğinin türev veriye etkisi.
 *
 * #321 rızayı alıp geri almayı kurmuştu ama TÜREV VERİYİ ele almamıştı:
 * rıza geri alındığında ondan üretilmiş analizler yerinde kalıyordu.
 */
describe("türev veri etkileri (#352)", () => {
  it("rıza GERİ ALININCA türev analizler silinir", async () => {
    oturum("u1");

    await POST(istek({ rizaVar: false }));

    expect(silMock).toHaveBeenCalledWith("u1");
  });

  it("silme SENKRON — yanıt döndüğünde silinmiş olmalı", async () => {
    // Arka plana atılsaydı kullanıcı "rıza kaldırıldı" görürken analiz hâlâ
    // duruyor olabilirdi.
    oturum("u1");

    await POST(istek({ rizaVar: false }));

    expect(arkaPlanIsleri).toHaveLength(0);
  });

  it("rıza VERİLİNCE eksik analiz üretimi ARKA PLANDA sıraya alınır", async () => {
    // Kullanıcıyı bir onay kutusu için AI çağrısı kadar bekletmenin anlamı yok.
    oturum("u1");

    await POST(istek({ rizaVar: true }));

    expect(uretMock).not.toHaveBeenCalled();
    expect(arkaPlanIsleri).toHaveLength(1);

    await arkaPlanIsleri[0]();
    expect(uretMock).toHaveBeenCalledWith("u1");
  });

  it("rıza verilince SİLME çağrılmaz", async () => {
    oturum("u1");

    await POST(istek({ rizaVar: true }));

    expect(silMock).not.toHaveBeenCalled();
  });

  it("geçersiz gövdede hiçbir yan etki tetiklenmez", async () => {
    oturum("u1");

    const res = await POST(istek({ rizaVar: "evet" }));

    expect(res.status).toBe(400);
    expect(silMock).not.toHaveBeenCalled();
    expect(arkaPlanIsleri).toHaveLength(0);
  });
});

