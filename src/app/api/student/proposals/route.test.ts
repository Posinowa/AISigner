// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ONERI_SINIRLARI } from "@/lib/validations/api";

/**
 * Stajyerin kendi proje önerisi ucu (#366).
 *
 * ⚠️ EN KRİTİK İDDİA — #208 mezun kapısı: onaylanan öneri bir
 * `AssignedProject`'e dönüşüyor, yani bu uç SİSTEM DURUMUNU DEĞİŞTİRİYOR.
 * #208'in ayrımına göre ("sistem durumunu değiştiren uçlar kapalı, insan
 * iletişimi açık") POST mezuna kapalı, GET (kendi geçmişini okuma) açık.
 * Kapı adım/dosya/yorum/ai-chat uçlarına konmuş ama buraya konmamıştı.
 */
const { requireAuthMock, olusturMock, listeMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  olusturMock: vi.fn(),
  listeMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/features/proposals/server/oneri", () => ({
  oneriOlustur: olusturMock,
  ogrencininOnerileri: listeMock,
}));

import { GET, POST } from "./route";

const gecerliGovde = {
  title: "a".repeat(ONERI_SINIRLARI.baslik.enAz),
  description: "a".repeat(ONERI_SINIRLARI.aciklama.enAz),
  goals: "a".repeat(ONERI_SINIRLARI.hedefler.enAz),
  technologies: ["Next.js"],
  kaynak: "BIZIM",
};

const istek = (govde: unknown = gecerliGovde) =>
  new Request("http://t/api/student/proposals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(govde),
  });

function oturum(accountStatus = "APPROVED") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "ogr-1", role: "STUDENT", accountStatus } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  oturum();
  olusturMock.mockResolvedValue({ ok: true, veri: { id: "o1" } });
  listeMock.mockResolvedValue([]);
});

describe("#208 mezun kapısı", () => {
  it("⚠️ GRADUATED stajyer YENİ öneri açamaz → 403", async () => {
    oturum("GRADUATED");

    const res = await POST(istek());

    expect(res.status).toBe(403);
    expect(olusturMock).not.toHaveBeenCalled();
  });

  it("kapı doğrulamadan ÖNCE — geçersiz gövdeyle de 403, 400 değil", async () => {
    // Aksi halde mezun, hata mesajından ucun kendisine açık olduğunu çıkarırdı.
    oturum("GRADUATED");

    const res = await POST(istek({ title: "kısa" }));

    expect(res.status).toBe(403);
    expect(olusturMock).not.toHaveBeenCalled();
  });

  it("mezun KENDİ geçmiş önerilerini OKUYABİLİR — GET açık", async () => {
    // Portfolyo salt-okunur; okuma kısıtlanmıyor.
    oturum("GRADUATED");

    const res = await GET();

    expect(res.status).toBe(200);
    expect(listeMock).toHaveBeenCalledWith("ogr-1");
  });

  it("APPROVED stajyer etkilenmez", async () => {
    const res = await POST(istek());

    expect(res.status).toBe(201);
    expect(olusturMock).toHaveBeenCalled();
  });
});

describe("yetki ve kapsam", () => {
  it("rol kapısı: yalnız STUDENT", async () => {
    await POST(istek());
    expect(requireAuthMock).toHaveBeenCalledWith("STUDENT");
  });

  it("oturumsuzsa yazmaz", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 401 }),
    });

    const res = await POST(istek());

    expect(res.status).toBe(401);
    expect(olusturMock).not.toHaveBeenCalled();
  });

  it("kapsam OTURUMDAN gelir — istemci başkasının kimliğini geçiremez", async () => {
    await POST(istek({ ...gecerliGovde, studentUserId: "baskasi" }));

    expect(olusturMock).toHaveBeenCalledWith(
      expect.objectContaining({ studentUserId: "ogr-1" }),
    );
  });

  it("geçersiz gövde 400", async () => {
    const res = await POST(istek({ title: "kısa" }));

    expect(res.status).toBe(400);
    expect(olusturMock).not.toHaveBeenCalled();
  });

  it("bekleyen öneri varsa 409", async () => {
    olusturMock.mockResolvedValue({ ok: false, neden: "zaten-bekliyor" });

    const res = await POST(istek());

    expect(res.status).toBe(409);
  });
});
