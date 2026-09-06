// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * #249 — API onay kapısı sözleşmesi.
 *
 * `requireAuth` içindeki onay kontrolü yalnızca STUDENT rolüne uygulanıyordu;
 * yorum da bunu açıkça söylüyordu ("Admin/mentor bu kontrolden etkilenmez").
 * Onaylanmamış bir MENTOR hesabı mentör uçlarını çağırabiliyordu.
 */

const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: sessionMock }));
vi.mock("@/lib/auth/nextauth", () => ({ authOptions: {} }));

import { requireAuth } from "./guard";

type Rol = "ADMIN" | "MENTOR" | "STUDENT";

function oturum(role: Rol, accountStatus?: string) {
  sessionMock.mockResolvedValue({
    user: { id: "k1", role, accountStatus },
  });
}

async function cagir(
  gerekliRol?: Rol | Rol[],
  options?: { allowUnapprovedStudent?: boolean },
) {
  const r = await requireAuth(gerekliRol, options);
  return {
    izinli: r.authorized,
    durum: r.authorized ? 200 : r.response.status,
  };
}

beforeEach(() => sessionMock.mockReset());

describe("requireAuth — onaylanmamış mentör (#249)", () => {
  it.each(["PENDING", "REJECTED"])(
    "%s mentör mentör ucunu çağıramaz",
    async (durum) => {
      oturum("MENTOR", durum);
      const r = await cagir("MENTOR");
      expect(r.izinli, "onaylanmamış mentör reddedilmeli").toBe(false);
      expect(r.durum).toBe(403);
    },
  );

  it.each(["APPROVED", "GRADUATED"])(
    "%s mentör mentör ucunu çağırabilir",
    async (durum) => {
      oturum("MENTOR", durum);
      expect((await cagir("MENTOR")).izinli).toBe(true);
    },
  );

  it("onaylanmamış mentör stajyer istisnasından yararlanamaz", async () => {
    // `allowUnapprovedStudent` profil tamamlama uçları için; mentöre açılmamalı.
    oturum("MENTOR", "PENDING");
    const r = await cagir("MENTOR", { allowUnapprovedStudent: true });
    expect(r.izinli).toBe(false);
  });
});

describe("requireAuth — admin kapsam dışı (#249)", () => {
  it.each(["PENDING", "REJECTED"])(
    "%s admin çağırmayı sürdürür",
    async (durum) => {
      oturum("ADMIN", durum);
      expect((await cagir("ADMIN")).izinli).toBe(true);
    },
  );
});

describe("requireAuth — stajyer davranışı korunuyor (#249 regresyon)", () => {
  it("PENDING stajyer normal ucu çağıramaz", async () => {
    oturum("STUDENT", "PENDING");
    expect((await cagir("STUDENT")).izinli).toBe(false);
  });

  it("PENDING stajyer profil tamamlama ucunu çağırabilir (#143)", async () => {
    oturum("STUDENT", "PENDING");
    expect(
      (await cagir("STUDENT", { allowUnapprovedStudent: true })).izinli,
    ).toBe(true);
  });

  it("REJECTED stajyer istisnadan yararlanamaz", async () => {
    oturum("STUDENT", "REJECTED");
    expect(
      (await cagir("STUDENT", { allowUnapprovedStudent: true })).izinli,
    ).toBe(false);
  });

  it("APPROVED stajyer çağırabilir", async () => {
    oturum("STUDENT", "APPROVED");
    expect((await cagir("STUDENT")).izinli).toBe(true);
  });
});

describe("requireAuth — oturum ve rol (#249 regresyon)", () => {
  it("oturum yoksa 401", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await cagir("STUDENT")).toEqual({ izinli: false, durum: 401 });
  });

  it("yanlış rol 403 alır", async () => {
    oturum("STUDENT", "APPROVED");
    expect((await cagir("ADMIN")).durum).toBe(403);
  });

  it("rol dizisi içinde olmak yeterlidir", async () => {
    oturum("MENTOR", "APPROVED");
    expect((await cagir(["ADMIN", "MENTOR"])).izinli).toBe(true);
  });
});

/**
 * #391 — SİLİNMİŞ KULLANICININ JETONU HÂLÂ İŞ GÖRÜYORDU.
 *
 * `nextauth.ts` JWT callback'i silinmiş kullanıcıda `token.role = undefined`
 * yapıyor — doğru. Ama guard iki yerden birden kaçırıyordu:
 *
 *   1. Rol kontrolü `if (requiredRole)` içindeydi; `requireAuth()` rolsüz
 *      çağrıldığında (ör. `/api/suggestions`) blok hiç çalışmıyordu.
 *   2. Durum kapısı `role === "STUDENT" || "MENTOR"` ile sınırlı; role
 *      undefined olduğu için o da devre dışı kalıyordu.
 */
describe("silinmiş kullanıcı — rolsüz jeton (#391)", () => {
  /** JWT callback'in silinmiş kullanıcı için ürettiği oturum. */
  function silinmisOturum() {
    sessionMock.mockResolvedValue({
      user: { id: "k1", role: undefined, accountStatus: undefined },
    });
  }

  it("⚠️ ROLSÜZ çağrıda da reddedilir — asıl açık buydu", async () => {
    silinmisOturum();

    const r = await cagir();

    expect(r.izinli).toBe(false);
    expect(r.durum).toBe(401);
  });

  it("rol İSTENEN uçta da reddedilir", async () => {
    silinmisOturum();

    const r = await cagir("STUDENT");

    expect(r.izinli).toBe(false);
    expect(r.durum).toBe(401);
  });

  it.each([["ADMIN"], ["MENTOR"], ["STUDENT"]] as const)(
    "%s beklenen uçta da geçemez",
    async (rol) => {
      silinmisOturum();
      const r = await cagir(rol);
      expect(r.izinli).toBe(false);
    },
  );

  it("401 döner, 403 DEĞİL — hesap artık yok, istemci yeniden giriş yapmalı", async () => {
    silinmisOturum();

    const r = await requireAuth();

    expect(r.authorized).toBe(false);
    if (!r.authorized) {
      expect(r.response.status).toBe(401);
      expect((await r.response.json()).error).toContain("yeniden giriş");
    }
  });

  it("boş string rol de geçersiz sayılır", async () => {
    sessionMock.mockResolvedValue({ user: { id: "k1", role: "" } });

    const r = await cagir();
    expect(r.izinli).toBe(false);
  });

  it("allowUnapprovedStudent ROLSÜZ jetonu KURTARMAZ", async () => {
    // #143 istisnası profil tamamlama içindi; silinmiş hesabı açmamalı.
    silinmisOturum();

    const r = await cagir("STUDENT", { allowUnapprovedStudent: true });

    expect(r.izinli).toBe(false);
  });
});

/**
 * #391 regresyon koruması: mevcut roller ETKİLENMEMELİ.
 */
describe("rol varlığı kapısı mevcut akışları bozmuyor (#391)", () => {
  it("APPROVED stajyer rolsüz çağrıda geçer", async () => {
    oturum("STUDENT", "APPROVED");
    expect((await cagir()).izinli).toBe(true);
  });

  it("PENDING stajyer profil tamamlama istisnasıyla geçer (#143)", async () => {
    oturum("STUDENT", "PENDING");
    expect((await cagir("STUDENT", { allowUnapprovedStudent: true })).izinli).toBe(true);
  });

  it("GRADUATED stajyer geçer (#208 — insan iletişimi açık)", async () => {
    oturum("STUDENT", "GRADUATED");
    expect((await cagir()).izinli).toBe(true);
  });

  it("ADMIN accountStatus olmadan da geçer", async () => {
    oturum("ADMIN");
    expect((await cagir("ADMIN")).izinli).toBe(true);
  });
});
