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

/**
 * #249 — onay kapısı ROLDEN BAĞIMSIZ olmalı.
 *
 * Kapının tamamı `userRole === "STUDENT"` içindeydi; onaylanmamış bir MENTOR
 * hesabı mentör paneline girebiliyordu. Mentör başvuru akışı (#250) bunu
 * ulaşılabilir bir açığa çevireceği için önce burası kapatılıyor.
 */
describe("Middleware — onaylanmamış mentör (#249)", () => {
  const mentor = (accountStatus: string) =>
    getTokenMock.mockResolvedValue({ role: "MENTOR", accountStatus });

  it.each(["PENDING", "REJECTED"])(
    "%s mentör mentör paneline giremez",
    async (durum) => {
      mentor(durum);
      const r = await git("/mentor-dashboard");
      expect(r.yonlendirdi, "onaylanmamış mentör engellenmeli").toBe(true);
      expect(r.hedef).toBe("/account-status");
    },
  );

  it.each(["APPROVED", "GRADUATED"])(
    "%s mentör mentör paneline girebilir",
    async (durum) => {
      mentor(durum);
      expect((await git("/mentor-dashboard")).hedef).not.toBe("/account-status");
    },
  );

  it("onaylanmamış mentör durum ekranını görebilir — döngü oluşmaz", async () => {
    mentor("PENDING");
    expect((await git("/account-status")).hedef).not.toBe("/account-status");
  });

  it("onaylanmamış mentör stajyer profil rotalarından yararlanamaz", async () => {
    // #143 istisnası stajyere özel; mentör oradan sızmamalı.
    mentor("PENDING");
    const r = await git("/student-onboarding");
    expect(r.yonlendirdi).toBe(true);
    expect(r.hedef).not.toBe("/student-onboarding");
  });
});

describe("Middleware — admin kapıdan etkilenmez (#249)", () => {
  it.each(["PENDING", "REJECTED"])(
    "%s admin yönetim paneline erişmeyi sürdürür",
    async (durum) => {
      // Admin bilerek kapsam dışı: kendi hesabını kilitleyememeli.
      getTokenMock.mockResolvedValue({ role: "ADMIN", accountStatus: durum });
      expect((await git("/admin-dashboard")).hedef).not.toBe("/account-status");
    },
  );
});

describe("Middleware — stajyer davranışı korunuyor (#249 regresyon)", () => {
  it("PENDING stajyer profilini tamamlayabilir (#143)", async () => {
    getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "PENDING" });
    expect((await git("/student-onboarding")).hedef).not.toBe("/account-status");
    expect((await git("/profile-setup")).hedef).not.toBe("/account-status");
  });

  it("PENDING stajyer panele giremez", async () => {
    getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "PENDING" });
    expect((await git("/student-dashboard")).hedef).toBe("/account-status");
  });

  it("REJECTED stajyer profil rotalarına da giremez", async () => {
    getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "REJECTED" });
    expect((await git("/student-onboarding")).hedef).toBe("/account-status");
  });
});

/**
 * #262 — sıfırlama bağlantısı oturumsuz açılabilmeli.
 *
 * `/reset-password` public listede değilse, e-postadaki bağlantıya tıklayan
 * (ve doğal olarak giriş yapmamış) kullanıcı signin'e sektirilir; şifresini
 * hiçbir zaman sıfırlayamaz.
 */
describe("Middleware — şifre sıfırlama sayfası (#262)", () => {
  it("oturumsuz kullanıcı /reset-password sayfasını açabilir", async () => {
    getTokenMock.mockResolvedValue(null);

    const r = await git("/reset-password");

    expect(r.yonlendirdi, "sıfırlama bağlantısı oturum istememeli").toBe(false);
  });

  it("token parametresiyle de açılabilir", async () => {
    getTokenMock.mockResolvedValue(null);
    expect((await git("/reset-password?token=abc")).yonlendirdi).toBe(false);
  });

  it("/forgot-password oturumsuz açık kalmayı sürdürür", async () => {
    getTokenMock.mockResolvedValue(null);
    expect((await git("/forgot-password")).yonlendirdi).toBe(false);
  });
});

describe("Middleware — mentörün profil tamamlama yolu (#287)", () => {
  const kapi = async (accountStatus: string, yol: string) => {
    getTokenMock.mockResolvedValue({ role: "MENTOR", accountStatus });
    return git(yol);
  };

  it("ONAYSIZ mentör başvuru sorularına erişebilir", async () => {
    // Sorular tam da hesap PENDING iken doldurulur; onay bu adımdan SONRA gelir.
    expect((await kapi("PENDING", "/mentor-profile-setup")).yonlendirdi).toBe(false);
  });

  it("onaysız mentör mentör panelinin GERİ KALANINA giremez", async () => {
    // Kapı gevşetilmiş olmamalı: yalnızca profil tamamlama yolu açıldı.
    const sonuc = await kapi("PENDING", "/mentor-dashboard");

    expect(sonuc.yonlendirdi).toBe(true);
    expect(sonuc.hedef).toBe("/account-status");
  });

  it("REDDEDİLEN mentör başvuru sorularına da giremez", async () => {
    // Reddedilmiş hesabın cevaplarını güncellemesinin bir anlamı yok.
    const sonuc = await kapi("REJECTED", "/mentor-profile-setup");

    expect(sonuc.yonlendirdi).toBe(true);
    expect(sonuc.hedef).toBe("/account-status");
  });

  it("ONAYLI mentör başvuru sayfasını açabilir (cevaplarını güncelleyebilir)", async () => {
    expect((await kapi("APPROVED", "/mentor-profile-setup")).yonlendirdi).toBe(false);
  });

  it("STAJYER mentör başvuru sayfasına giremez", async () => {
    getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "APPROVED" });
    const sonuc = await git("/mentor-profile-setup");

    expect(sonuc.yonlendirdi).toBe(true);
    expect(sonuc.hedef).toBe("/student-dashboard");
  });
});

/**
 * #375 — API ROTALARI HTML'E YÖNLENDİRİLMEZ.
 *
 * `/api/` kontrolü dosyanın SONUNDA duruyordu ("guard.ts zaten koruma
 * sağlıyor") ve niyeti doğruydu; ama oturumsuz kullanıcıyı `/signin`'e yollayan
 * blok ondan ÖNCE çalışıyordu, yani API istekleri o satıra hiç ulaşmıyordu.
 *
 * Sonucu sinsiydi: oturumu düşen istemcide `fetch(...).json()` HTML alıp
 * SyntaxError fırlatıyor, bileşenler bunu "veri yüklenemedi" diye
 * gösteriyordu — kullanıcı oturumunun düştüğünü öğrenemiyordu.
 */
describe("API yanıt sözleşmesi (#375)", () => {
  const API_YOLLARI = [
    "/api/student/proposals",
    "/api/messages/conversations",
    "/api/mentor/students",
    "/api/admin/proposals",
    "/api/messages/stream",
  ];

  describe("oturumsuz", () => {
    beforeEach(() => getTokenMock.mockResolvedValue(null));

    it.each(API_YOLLARI)("%s → 401 JSON, yönlendirme YOK", async (yol) => {
      const r = await middleware(istek(yol));

      expect(r.status).toBe(401);
      expect(r.headers.get("location")).toBeNull();
      expect(r.headers.get("content-type")).toContain("application/json");
      expect(await r.json()).toEqual({ error: "Oturum açılmamış. Lütfen giriş yapın." });
    });

    it("SAYFA rotaları hâlâ /signin'e yönlenir — davranış değişmemeli", async () => {
      const r = await git("/student-dashboard");
      expect(r.yonlendirdi).toBe(true);
      expect(r.hedef).toBe("/signin");
      expect(r.callbackUrl).toBe("/student-dashboard");
    });

    it.each(["/api/auth/csrf", "/api/auth/session", "/api/webhooks/github", "/api/health"])(
      "%s public kalır — oturumsuz erişilebilir",
      async (yol) => {
        const r = await middleware(istek(yol));
        // Public liste middleware'i erkenden geçiriyor; 401 DÖNMEMELİ.
        expect(r.status).not.toBe(401);
        expect(r.headers.get("location")).toBeNull();
      },
    );
  });

  /**
   * ⚠️ Aşağıdaki iki test SONUCU kilitliyor, MEKANİZMAYI değil.
   *
   * Ölçüldü: `if (apiIstegi) return next()` bloğu kaldırılsa bu testler yine
   * geçiyor — çünkü mevcut yönlendirmelerin hiçbiri `/api/...` ile eşleşmiyor.
   * Blok, gelecekte bir yönlendirme genişlediğinde kuralı korumak için
   * savunma amaçlı duruyor; testler de sözleşmenin kendisini bekliyor:
   * "oturumlu bir API isteği HTML'e yönlendirilmez", nasıl sağlandığından
   * bağımsız.
   */
  describe("oturum var ama rol uymuyor", () => {
    it("API isteği yönlendirilmez — yetki kararı guard.ts'e bırakılır", async () => {
      // STUDENT, admin ucunu çağırıyor. Middleware bunu /student-dashboard'a
      // yönlendirseydi istemci yine HTML alırdı.
      getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "APPROVED" });

      const r = await middleware(istek("/api/admin/proposals"));

      expect(r.headers.get("location")).toBeNull();
      expect(r.status).not.toBeGreaterThanOrEqual(300);
    });

    it("onaysız stajyerin API isteği de yönlendirilmez", async () => {
      getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "PENDING" });

      const r = await middleware(istek("/api/student/steps/abc"));

      expect(r.headers.get("location")).toBeNull();
    });

    it("SAYFA rotasında onaysız stajyer hâlâ /account-status'a gider", async () => {
      getTokenMock.mockResolvedValue({ role: "STUDENT", accountStatus: "PENDING" });

      const r = await git("/student-dashboard");
      expect(r.hedef).toBe("/account-status");
    });
  });
});
