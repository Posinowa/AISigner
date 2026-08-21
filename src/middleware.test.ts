// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * G3 — Middleware herkese açık yüzey sözleşmesi.
 *
 * Açılış sayfası `/` rotasını oturumsuz ziyaretçiye açtı. Middleware bunu
 * zaten destekliyordu (`if (!token) { if (pathname === "/") next() }`), ama
 * bu davranış artık bir ÜRÜN GEREKSİNİMİ — kazara kaldırılırsa açılış sayfası
 * erişilemez olur.
 *
 * Ters yönü de aynı derecede önemli: herkese açık yüzeyin sessizce genişlemesi.
 * Bu testler korumalı rotaların oturumsuz erişime KAPALI kaldığını doğrular.
 */

const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: getTokenMock }));

import { NextRequest } from "next/server";
import { middleware } from "./middleware";

// Düz `Request` yeterli değil: middleware `request.nextUrl` okuyor.
const istek = (yol: string) => new NextRequest(`http://localhost:3000${yol}`);

async function git(yol: string) {
  const r = await middleware(istek(yol));
  const konum = r.headers.get("location");
  return {
    yonlendirdi: r.status >= 300 && r.status < 400,
    hedef: konum ? new URL(konum).pathname : null,
    callbackUrl: konum ? new URL(konum).searchParams.get("callbackUrl") : null,
  };
}

beforeEach(() => getTokenMock.mockReset());

describe("Middleware — oturumsuz ziyaretçi", () => {
  beforeEach(() => getTokenMock.mockResolvedValue(null));

  it("kök rotaya erişebilir (açılış sayfası)", async () => {
    const r = await git("/");
    expect(r.yonlendirdi).toBe(false);
  });

  it.each(["/signin", "/signup", "/forgot-password", "/terms", "/privacy"])(
    "public rota %s açıktır",
    async (yol) => {
      expect((await git(yol)).yonlendirdi).toBe(false);
    },
  );

  it.each([
    "/admin-dashboard",
    "/mentor-dashboard",
    "/student-dashboard",
    "/student-onboarding",
    "/profile-setup",
    "/account-status",
  ])("korumalı rota %s signin'e yönlendirir", async (yol) => {
    const r = await git(yol);
    expect(r.yonlendirdi).toBe(true);
    expect(r.hedef).toBe("/signin");
    expect(r.callbackUrl).toBe(yol);
  });

  it("bilinmeyen bir rota da korumalıdır (varsayılan kapalı)", async () => {
    const r = await git("/rastgele-bir-sayfa");
    expect(r.yonlendirdi).toBe(true);
    expect(r.hedef).toBe("/signin");
  });
});

describe("Middleware — oturumlu kullanıcı", () => {
  it.each([
    ["ADMIN", "/admin-dashboard"],
    ["MENTOR", "/mentor-dashboard"],
    ["STUDENT", "/student-dashboard"],
  ])("%s signin'e giderse kendi paneline döner", async (rol, hedef) => {
    getTokenMock.mockResolvedValue({ role: rol, accountStatus: "APPROVED" });
    const r = await git("/signin");
    expect(r.yonlendirdi).toBe(true);
    expect(r.hedef).toBe(hedef);
  });

  it("rolsüz token signin'de kalır (yönlendirme döngüsü olmaz)", async () => {
    getTokenMock.mockResolvedValue({ name: "rolsuz" });
    expect((await git("/signin")).yonlendirdi).toBe(false);
  });

  it("yanlış roldeki kullanıcı korumalı panele giremez", async () => {
    getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "APPROVED" });
    const r = await git("/admin-dashboard");
    expect(r.yonlendirdi).toBe(true);
    expect(r.hedef).toBe("/student-dashboard");
  });
});

describe("Middleware — onaysız stajyer (#143 sözleşmesi)", () => {
  it("PENDING stajyer dashboard'a giremez", async () => {
    getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "PENDING" });
    const r = await git("/student-dashboard");
    expect(r.yonlendirdi).toBe(true);
    expect(r.hedef).toBe("/account-status");
  });

  it.each(["/student-onboarding", "/profile-setup"])(
    "PENDING stajyer profil tamamlama rotası %s'e erişebilir",
    async (yol) => {
      getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "PENDING" });
      expect((await git(yol)).yonlendirdi).toBe(false);
    },
  );

  it("REJECTED stajyer profil tamamlamaya da giremez", async () => {
    getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "REJECTED" });
    const r = await git("/student-onboarding");
    expect(r.yonlendirdi).toBe(true);
    expect(r.hedef).toBe("/account-status");
  });
});
