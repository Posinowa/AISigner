// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tek slot ucu (#398) — HTTP katmanı.
 *
 * Modül testleri yarış korumalarını kilitliyor; burada ölçülen şey bu
 * katmanın kendi kararları: rol kapıları, hangi sonucun hangi DURUM KODUNA
 * çevrildiği ve `?tamamen=1` bayrağının kime açık olduğu.
 */
const { requireAuthMock, rezerveMock, iptalMock, silMock, notMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  rezerveMock: vi.fn(),
  iptalMock: vi.fn(),
  silMock: vi.fn(),
  notMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/ofis-saati/server/ofis-saati", () => ({
  slotuRezerveEt: rezerveMock,
  rezervasyonuIptalEt: iptalMock,
  slotuSil: silMock,
  gorusmeNotuKaydet: notMock,
}));

import { POST, PATCH, DELETE } from "./route";

const params = Promise.resolve({ slotId: "s-1" });

const govdeli = (metot: string, govde: unknown) =>
  new Request("http://t/api/ofis-saati/s-1", {
    method: metot,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(govde),
  });

const silIstegi = (qs = "") =>
  new Request(`http://t/api/ofis-saati/s-1${qs}`, { method: "DELETE" });

function oturum(rol: "MENTOR" | "STUDENT", id = "u-1", accountStatus = "APPROVED") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id, role: rol, accountStatus } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  oturum("STUDENT", "ogr-1");
  rezerveMock.mockResolvedValue({ ok: true, veri: { slotId: "s-1" } });
  iptalMock.mockResolvedValue({ ok: true, veri: undefined });
  silMock.mockResolvedValue({ ok: true, veri: undefined });
  notMock.mockResolvedValue({ ok: true, veri: undefined });
});

describe("POST — rezervasyon", () => {
  it("rol kapısı STUDENT", async () => {
    await POST(govdeli("POST", {}), { params });
    expect(requireAuthMock).toHaveBeenCalledWith("STUDENT");
  });

  it("⚠️ kapsam OTURUMDAN — başkası adına rezerve edilemez", async () => {
    oturum("STUDENT", "ogr-8");

    await POST(govdeli("POST", { not: "merhaba", studentUserId: "baskasi" }), { params });

    expect(rezerveMock).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: "s-1", studentUserId: "ogr-8" }),
    );
  });

  it("⚠️ 'slot-yok' → 404: YETKİSİZLİK de aynı yanıtı alır", async () => {
    // Başkasının takvimindeki bir slotun VAR OLDUĞU bile sızmamalı.
    rezerveMock.mockResolvedValue({ ok: false, neden: "slot-yok" });

    const res = await POST(govdeli("POST", {}), { params });

    expect(res.status).toBe(404);
  });

  it("⚠️ 'dolu' → 409: yarışı kaybeden ayrı bir kod alır", async () => {
    // 404 dönseydi istemci "slot silinmiş" der, "az önce kapıldı" diyemezdi.
    rezerveMock.mockResolvedValue({ ok: false, neden: "dolu" });

    const res = await POST(govdeli("POST", {}), { params });

    expect(res.status).toBe(409);
  });

  it("'gecmis-zaman' → 400", async () => {
    rezerveMock.mockResolvedValue({ ok: false, neden: "gecmis-zaman" });

    const res = await POST(govdeli("POST", {}), { params });

    expect(res.status).toBe(400);
  });

  it("⚠️ MEZUN stajyer rezerve EDEBİLİR — #208'in bilinçli istisnası", async () => {
    // Görüşme mesajlaşmanın eşi (referans, kariyer tavsiyesi) ve kıtlık
    // mentörün kontrolünde: slotu o açıyor, iptal edebiliyor.
    oturum("STUDENT", "ogr-1", "GRADUATED");

    const res = await POST(govdeli("POST", {}), { params });

    expect(res.status).toBe(200);
    expect(rezerveMock).toHaveBeenCalled();
  });
});

describe("PATCH — görüşme notu", () => {
  it("rol kapısı MENTOR — stajyer kendi hakkındaki notu yazamaz", async () => {
    await PATCH(govdeli("PATCH", { not: "Görüşme verimliydi." }), { params });
    expect(requireAuthMock).toHaveBeenCalledWith("MENTOR");
  });

  it("kapsam OTURUMDAN", async () => {
    oturum("MENTOR", "men-2");

    await PATCH(govdeli("PATCH", { not: "Görüşme verimliydi." }), { params });

    expect(notMock).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: "s-1", mentorUserId: "men-2" }),
    );
  });

  it("başkasının slotu → 404", async () => {
    oturum("MENTOR", "men-2");
    notMock.mockResolvedValue({ ok: false, neden: "slot-yok" });

    const res = await PATCH(govdeli("PATCH", { not: "Görüşme verimliydi." }), { params });

    expect(res.status).toBe(404);
  });

  it("geçersiz gövde 400 — modüle gidilmez", async () => {
    oturum("MENTOR", "men-2");

    const res = await PATCH(govdeli("PATCH", { not: 42 }), { params });

    expect(res.status).toBe(400);
    expect(notMock).not.toHaveBeenCalled();
  });
});

describe("DELETE — iptal mi silme mi", () => {
  it("bayraksız istek REZERVASYONU İPTAL eder, slotu silmez", async () => {
    await DELETE(silIstegi(), { params });

    expect(iptalMock).toHaveBeenCalled();
    expect(silMock).not.toHaveBeenCalled();
  });

  it("mentör ?tamamen=1 ile boş slotu siler", async () => {
    oturum("MENTOR", "men-1");

    await DELETE(silIstegi("?tamamen=1"), { params });

    expect(silMock).toHaveBeenCalledWith({ slotId: "s-1", mentorUserId: "men-1" });
    expect(iptalMock).not.toHaveBeenCalled();
  });

  it("⚠️ STAJYER ?tamamen=1 ile SİLEMEZ — yalnız iptal eder", async () => {
    // Bayrak istemciden geliyor; rol kontrolü olmasaydı stajyer mentörün
    // takvim satırını tamamen kaldırabilirdi.
    await DELETE(silIstegi("?tamamen=1"), { params });

    expect(silMock).not.toHaveBeenCalled();
    expect(iptalMock).toHaveBeenCalled();
  });

  it("iptal koşulu ROLE göre daraltılsın diye rol aktarılır", async () => {
    oturum("STUDENT", "ogr-4");

    await DELETE(silIstegi(), { params });

    expect(iptalMock).toHaveBeenCalledWith({
      slotId: "s-1",
      userId: "ogr-4",
      rol: "STUDENT",
    });
  });

  it("başkasının rezervasyonu → 404", async () => {
    iptalMock.mockResolvedValue({ ok: false, neden: "slot-yok" });

    const res = await DELETE(silIstegi(), { params });

    expect(res.status).toBe(404);
  });

  it("iki rol de silme/iptal edebilir", async () => {
    await DELETE(silIstegi(), { params });
    expect(requireAuthMock).toHaveBeenCalledWith(["MENTOR", "STUDENT"]);
  });
});
