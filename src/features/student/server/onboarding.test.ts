// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Onboarding server action'ının YETKİ kapısı.
 *
 * #143'ün sözleşmesi: stajyer profilini PENDING iken tamamlar, onay bu
 * adımdan SONRA gelir. Bu yüzden burası "onaysız STUDENT'ı engelle"
 * kuralının BİLİNÇLİ istisnası — ve testlerin ilk işi o istisnayı
 * korumak.
 *
 * ⚠️ Ama istisna "hiç sorma" demek değildi. Dosya düz `getServerSession`
 * kullanıyordu ve iki soruyu hiç sormuyordu:
 *   1. REJECTED stajyer — middleware yalnız SAYFAYI kapatıyor, server
 *      action doğrudan çağrılabiliyor.
 *   2. Rol — MENTOR/ADMIN kendine `StudentProfile` üretebiliyordu.
 * `allowUnapprovedStudent` seçeneği tam bunun için vardı; bu çağrı yeri
 * hiç taşınmamıştı.
 */
const { requireAuthMock, txMock, upsertMock, userUpdateMock, rizaMock, analizMock } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    txMock: vi.fn(),
    upsertMock: vi.fn(),
    userUpdateMock: vi.fn(),
    rizaMock: vi.fn(),
    analizMock: vi.fn(),
  }));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/auth/prisma", () => ({
  prisma: {
    $transaction: (...a: unknown[]) => txMock(...a),
    user: { update: userUpdateMock },
    studentProfile: { upsert: upsertMock },
  },
}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/features/kvkk/riza", () => ({ aiRizasiVar: rizaMock }));
vi.mock("@/features/ai/server/profile-analysis-store", () => ({
  generateAndPersistProfileAnalysis: analizMock,
}));

import { saveOnboarding } from "./onboarding";

const GECERLI = {
  personal: {
    firstName: "Ayşe",
    lastName: "Yılmaz",
    birthYear: 2002,
    phoneNumber: "5551234567",
  },
  experience: { level: "beginner", interest: ["Backend"] },
  goals: { goal: "Backend tarafında kendimi geliştirmek istiyorum" },
};

/** requireAuth'un başarılı dönüşü. */
function izinVer(userId = "ogr-1") {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: userId, role: "STUDENT", accountStatus: "PENDING" } },
  });
}

/** requireAuth'un reddi — gerçek guard gibi NextResponse döndürür. */
function reddet(mesaj: string, status: number) {
  requireAuthMock.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: mesaj }, { status }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  izinVer();
  rizaMock.mockResolvedValue(false);
  txMock.mockResolvedValue([{}, { id: "sp-1" }]);
});

describe("yetki kapısı", () => {
  it("⚠️ #143 KORUNUYOR — PENDING stajyer profilini tamamlayabilir", async () => {
    // Bu akış kırılırsa onboarding tamamen çöker; testin ilk işi bu.
    // Eylem değer DÖNDÜRMÜYOR (yönlendirmeyi istemci yapıyor) — ölçülen
    // şey fırlatmaması ve yazmanın gerçekleşmesi.
    await expect(saveOnboarding(GECERLI)).resolves.toBeUndefined();
    expect(txMock).toHaveBeenCalled();
  });

  it("guard'a STUDENT + allowUnapprovedStudent geçirilir", async () => {
    await saveOnboarding(GECERLI);

    expect(requireAuthMock).toHaveBeenCalledWith("STUDENT", {
      allowUnapprovedStudent: true,
    });
  });

  it("⚠️ REJECTED stajyer YAZAMAZ — middleware yalnız sayfayı kapatıyordu", async () => {
    reddet("Hesabınız henüz onaylanmadı.", 403);

    await expect(saveOnboarding(GECERLI)).rejects.toThrow("Hesabınız henüz onaylanmadı.");
    expect(txMock).not.toHaveBeenCalled();
  });

  it("⚠️ MENTOR/ADMIN kendine StudentProfile üretemez", async () => {
    reddet("Bu işlem için yetkiniz bulunmuyor.", 403);

    await expect(saveOnboarding(GECERLI)).rejects.toThrow(/yetkiniz bulunmuyor/);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("oturumsuz istekte yazma YOK", async () => {
    reddet("Oturum açılmamış. Lütfen giriş yapın.", 401);

    await expect(saveOnboarding(GECERLI)).rejects.toThrow(/Oturum açılmamış/);
    expect(txMock).not.toHaveBeenCalled();
  });

  it("hata mesajı GUARD'IN kendi metni — istemci tek cümle görsün (#375)", async () => {
    reddet("Oturumunuz artık geçerli değil. Lütfen yeniden giriş yapın.", 401);

    await expect(saveOnboarding(GECERLI)).rejects.toThrow(
      "Oturumunuz artık geçerli değil. Lütfen yeniden giriş yapın.",
    );
  });
});

describe("kapsam ve sıra", () => {
  it("kimlik OTURUMDAN gelir — istemci başkasının profilini yazamaz", async () => {
    izinVer("ogr-7");

    await saveOnboarding({ ...GECERLI, userId: "baskasi" });

    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ogr-7" } }),
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "ogr-7" } }),
    );
  });

  it("⚠️ yetki DOĞRULAMADAN ÖNCE — geçersiz veriyle de yetki hatası alınır", async () => {
    // Aksi halde yetkisiz çağıran, şema hatasından ucun kendisine açık
    // olduğunu çıkarırdı.
    reddet("Hesabınız henüz onaylanmadı.", 403);

    await expect(saveOnboarding({ tamamen: "bozuk" })).rejects.toThrow(
      "Hesabınız henüz onaylanmadı.",
    );
  });

  it("geçersiz veri şema hatası verir ve YAZMAZ", async () => {
    await expect(saveOnboarding({ tamamen: "bozuk" })).rejects.toThrow(/Geçersiz veri/);
    expect(txMock).not.toHaveBeenCalled();
  });
});

describe("KVKK rızası (#321)", () => {
  it("rıza yoksa AI analizi ÜRETİLMEZ ama profil yazılır", async () => {
    rizaMock.mockResolvedValue(false);

    await saveOnboarding(GECERLI);

    expect(txMock).toHaveBeenCalled();
    expect(analizMock).not.toHaveBeenCalled();
  });

  it("rıza varsa analiz üretilir", async () => {
    rizaMock.mockResolvedValue(true);
    analizMock.mockResolvedValue(undefined);

    await saveOnboarding(GECERLI);

    expect(analizMock).toHaveBeenCalled();
  });

  it("rıza OTURUMDAKİ kimlikle sorulur", async () => {
    izinVer("ogr-9");

    await saveOnboarding(GECERLI);

    expect(rizaMock).toHaveBeenCalledWith("ogr-9");
  });
});
