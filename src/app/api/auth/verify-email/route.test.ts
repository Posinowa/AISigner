import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * #247 — doğrulama rotası sözleşmesi.
 *
 * Rota oturum GEREKTİRMEZ (kullanıcı bağlantıya giriş yapmadan tıklar);
 * güvence tokenın imzasında. Bu testler geçersiz tokenın hesabı
 * doğrulayamadığını ve kullanıcıya neden ayrıntısı sızmadığını kilitliyor.
 */

const { markMock, verifyMock, loggerMock } = vi.hoisted(() => ({
  markMock: vi.fn(),
  verifyMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/auth/server/email-verification", () => ({
  markEmailVerified: markMock,
}));
vi.mock("@/lib/auth/verification-token", () => ({
  verifyVerificationToken: verifyMock,
}));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import { NextRequest } from "next/server";
import { GET } from "./route";

const istek = (sorgu: string) =>
  new NextRequest(`http://localhost:3000/api/auth/verify-email${sorgu}`);

async function cagir(sorgu: string) {
  const r = await GET(istek(sorgu));
  const konum = r.headers.get("location");
  return {
    yonlendirdi: r.status >= 300 && r.status < 400,
    yol: konum ? new URL(konum).pathname : null,
    durum: konum ? new URL(konum).searchParams.get("dogrulama") : null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  markMock.mockResolvedValue({ ok: true, alreadyVerified: false });
});

describe("verify-email — geçerli token", () => {
  beforeEach(() => verifyMock.mockReturnValue({ valid: true, userId: "k1" }));

  it("hesabı doğrular ve giriş ekranına yönlendirir", async () => {
    const r = await cagir("?token=gecerli");
    expect(markMock).toHaveBeenCalledWith("k1");
    expect(r.yol).toBe("/signin");
    expect(r.durum).toBe("tamam");
  });

  it("zaten doğrulanmış hesabı ayrı bildirir", async () => {
    markMock.mockResolvedValue({ ok: true, alreadyVerified: true });
    expect((await cagir("?token=gecerli")).durum).toBe("zaten-dogrulanmis");
  });

  it("token geçerli ama kullanıcı yoksa doğrulama yapılmaz", async () => {
    markMock.mockResolvedValue({ ok: false, reason: "user-not-found" });
    expect((await cagir("?token=gecerli")).durum).toBe("gecersiz");
  });
});

describe("verify-email — geçersiz token", () => {
  it("token yoksa hesap DOĞRULANMAZ", async () => {
    const r = await cagir("");
    expect(markMock).not.toHaveBeenCalled();
    expect(r.durum).toBe("gecersiz");
  });

  it.each([
    ["malformed", "gecersiz"],
    ["bad-signature", "gecersiz"],
  ] as const)("%s token reddedilir", async (reason, beklenen) => {
    verifyMock.mockReturnValue({ valid: false, reason });
    const r = await cagir("?token=bozuk");
    expect(markMock, "geçersiz token hesabı doğrulamamalı").not.toHaveBeenCalled();
    expect(r.durum).toBe(beklenen);
  });

  it("süresi geçmiş token ayrı bildirilir (kullanıcı yenisini isteyebilsin)", async () => {
    verifyMock.mockReturnValue({ valid: false, reason: "expired" });
    expect((await cagir("?token=eski")).durum).toBe("suresi-gecti");
  });

  it("geçersiz imza ile süresi geçmiş AYNI mesajı vermez ama imza nedeni sızmaz", async () => {
    // Kullanıcıya "imza geçersiz" denmez — yalnızca "gecersiz".
    verifyMock.mockReturnValue({ valid: false, reason: "bad-signature" });
    const r = await cagir("?token=sahte");
    expect(r.durum).not.toContain("signature");
    expect(r.durum).not.toContain("imza");
  });
});

describe("verify-email — beklenmeyen hata", () => {
  it("veritabanı erişilemezse ham 500 yerine anlamlı ekrana yönlendirir", async () => {
    verifyMock.mockReturnValue({ valid: true, userId: "k1" });
    markMock.mockRejectedValue(new Error("Can't reach database server"));

    const r = await cagir("?token=gecerli");
    expect(r.yonlendirdi, "yönlendirme yapmalı, hata fırlatmamalı").toBe(true);
    expect(r.durum).toBe("hata");
    expect(loggerMock.error).toHaveBeenCalled();
  });
});
