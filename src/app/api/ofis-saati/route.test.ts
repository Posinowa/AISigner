// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Ofis saati koleksiyon ucu (#398) — HTTP katmanı.
 *
 * `ofis-saati.ts` modülü zaten kapsamlı test altında (dilimleme, yarış
 * korumaları, bağlantı sızıntısı). Burada ölçülen şey MODÜL DEĞİL, onun
 * önündeki katman: rol kapıları, kapsamın oturumdan gelmesi ve maliyet
 * kapısı.
 */
const { requireAuthMock, acMock, mentorSlotMock, ogrenciSlotMock, limitMock } = vi.hoisted(
  () => ({
    requireAuthMock: vi.fn(),
    acMock: vi.fn(),
    mentorSlotMock: vi.fn(),
    ogrenciSlotMock: vi.fn(),
    limitMock: vi.fn<
      (anahtar: string) => Promise<{ allowed: boolean; retryAfterSeconds?: number }>
    >(async () => ({ allowed: true })),
  }),
);

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: (anahtar: string) => limitMock(anahtar) }),
}));
vi.mock("@/features/ofis-saati/server/ofis-saati", () => ({
  slotlariAc: acMock,
  mentorunSlotlari: mentorSlotMock,
  ogrencininGorebilecegiSlotlar: ogrenciSlotMock,
}));

import { GET, POST } from "./route";

/** Bugünden sonrası — geçmiş kontrolü modülde, burada değil. */
const YARIN = new Date(Date.now() + 864e5).toISOString();
const SONRA = new Date(Date.now() + 864e5 + 36e5).toISOString();

const istek = (govde: unknown = { baslangic: YARIN, bitis: SONRA }) =>
  new Request("http://t/api/ofis-saati", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(govde),
  });

function oturum(rol: "MENTOR" | "STUDENT", id = "u-1") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id, role: rol, accountStatus: "APPROVED" } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  oturum("MENTOR", "men-1");
  acMock.mockResolvedValue({ ok: true, veri: { olusturulan: 3 } });
  mentorSlotMock.mockResolvedValue([]);
  ogrenciSlotMock.mockResolvedValue([]);
});

describe("GET — rol'e göre farklı görünüm", () => {
  it("mentöre KENDİ takvimi döner", async () => {
    oturum("MENTOR", "men-7");

    const res = await GET();

    expect(await res.json()).toMatchObject({ rol: "MENTOR" });
    expect(mentorSlotMock).toHaveBeenCalledWith("men-7");
    expect(ogrenciSlotMock).not.toHaveBeenCalled();
  });

  it("stajyere YALNIZ kendi mentörlerinin slotları sorulur", async () => {
    oturum("STUDENT", "ogr-3");

    const res = await GET();

    expect(await res.json()).toMatchObject({ rol: "STUDENT" });
    expect(ogrenciSlotMock).toHaveBeenCalledWith("ogr-3");
    expect(mentorSlotMock).not.toHaveBeenCalled();
  });

  it("iki rol de kabul edilir, başkası edilmez", async () => {
    await GET();
    expect(requireAuthMock).toHaveBeenCalledWith(["MENTOR", "STUDENT"]);
  });
});

describe("POST — yalnız mentör açar", () => {
  it("rol kapısı MENTOR", async () => {
    await POST(istek());
    expect(requireAuthMock).toHaveBeenCalledWith("MENTOR");
  });

  it("yetkisizse modüle hiç gidilmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    const res = await POST(istek());

    expect(res.status).toBe(403);
    expect(acMock).not.toHaveBeenCalled();
  });

  it("⚠️ kapsam OTURUMDAN — istemci başka mentörün takvimine yazamaz", async () => {
    oturum("MENTOR", "men-9");

    await POST(istek({ baslangic: YARIN, bitis: SONRA, mentorUserId: "baskasi" }));

    expect(acMock).toHaveBeenCalledWith(
      expect.objectContaining({ mentorUserId: "men-9" }),
    );
  });

  it("başarıda 201 ve GERÇEKTEN oluşan sayı döner", async () => {
    // `skipDuplicates` atlananları saymıyor; arayüz uydurulmuş sayı görmemeli.
    acMock.mockResolvedValue({ ok: true, veri: { olusturulan: 2 } });

    const res = await POST(istek());

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true, olusturulan: 2 });
  });

  it("geçersiz gövde 400 — modüle gidilmez", async () => {
    const res = await POST(istek({ baslangic: "dün" }));

    expect(res.status).toBe(400);
    expect(acMock).not.toHaveBeenCalled();
  });

  it("modül hatası 400'e ve TÜRKÇE mesaja çevrilir", async () => {
    acMock.mockResolvedValue({ ok: false, neden: "cok-uzun" });

    const res = await POST(istek());

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/uzun/i);
  });
});

describe("maliyet kapısı", () => {
  /*
   * Slot açma satır ÜRETEN bir uç. Aynı aralığın tekrarı
   * `@@unique([mentorId, baslangic])` + `skipDuplicates` ile zaten 0 satır
   * ekliyor; kapının işi pencereyi kaydırarak ilerleyen bir döngüyü kesmek.
   */
  it("tavan dolduğunda 429 + Retry-After", async () => {
    limitMock.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });

    const res = await POST(istek());

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(acMock).not.toHaveBeenCalled();
  });

  it("sayaç MENTÖR BAŞINA", async () => {
    oturum("MENTOR", "men-5");

    await POST(istek());

    expect(limitMock).toHaveBeenCalledWith("men-5");
  });

  it("kapı YETKİDEN SONRA — yetkisiz istek sayacı tüketmez", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    await POST(istek());

    expect(limitMock).not.toHaveBeenCalled();
  });

  it("⚠️ GET kısıtlanmaz — okuma satır üretmiyor", async () => {
    await GET();
    expect(limitMock).not.toHaveBeenCalled();
  });
});
