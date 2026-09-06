// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Bildirim gönderimi (#380).
 *
 * Kilitlenen kararlar:
 *  - E-posta gitmese de UYGULAMA İÇİ kayıt düşer (#241 sözleşmesi)
 *  - Hiçbir durumda FIRLATMAZ — tetikleyen işlemi kırmamalı
 *  - E-posta listesi DAR: yalnız üç olay
 *  - Okundu işaretleme her zaman OTURUM sahibiyle sınırlı
 */

const { prismaMock, sendMailMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  sendMailMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/mail", () => ({ sendMail: sendMailMock }));

import {
  bildirimGonder,
  topluBildirimGonder,
  okunduIsaretle,
  okunmamisSayisi,
} from "./bildirim";
import { BILDIRIM_TURLERI } from "../turler";

const girdi = (ekle: Record<string, unknown> = {}) => ({
  userId: "u1",
  tur: BILDIRIM_TURLERI.HESAP_KARARI,
  baslik: "Hesabınız onaylandı",
  govde: "Artık panelinize erişebilirsiniz.",
  eposta: "u1@test.local",
  ...ekle,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notification.create.mockResolvedValue({ id: "n1" });
  prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });
  sendMailMock.mockResolvedValue({ sent: true });
});

describe("uygulama içi kayıt", () => {
  it("bildirim satırı yazılır", async () => {
    await bildirimGonder(girdi());

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        type: BILDIRIM_TURLERI.HESAP_KARARI,
        title: "Hesabınız onaylandı",
        body: "Artık panelinize erişebilirsiniz.",
        link: null,
        // #397: Bildirimin bağlı olduğu kayıt (ör. adım kimliği). Tekrar
        // bildirimi önlemek için; bu olayda yok.
        refId: null,
      },
    });
  });

  it("⚠️ E-POSTA PATLASA DA satır düşer — #241 sözleşmesi", async () => {
    sendMailMock.mockResolvedValue({ sent: false, reason: "not-configured" });

    await bildirimGonder(girdi());

    expect(prismaMock.notification.create).toHaveBeenCalled();
  });

  it("KAYIT patlarsa e-posta GÖNDERİLMEZ", async () => {
    // Kullanıcı e-postayı görüp uygulamada karşılığını bulamazsa daha
    // kafa karıştırıcı olur.
    prismaMock.notification.create.mockRejectedValue(new Error("db down"));

    await bildirimGonder(girdi());

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it("HİÇBİR DURUMDA fırlatmaz — tetikleyen işlemi kırmamalı", async () => {
    prismaMock.notification.create.mockRejectedValue(new Error("db down"));
    await expect(bildirimGonder(girdi())).resolves.toBeUndefined();
  });
});

describe("e-posta listesi DAR", () => {
  it.each([
    BILDIRIM_TURLERI.HESAP_KARARI,
    BILDIRIM_TURLERI.MENTOR_ATANDI,
    BILDIRIM_TURLERI.ONERI_KARARI,
    BILDIRIM_TURLERI.CALISMA_ALANI_KARARI,
  ])("%s → e-posta gider", async (tur) => {
    await bildirimGonder(girdi({ tur }));
    expect(sendMailMock).toHaveBeenCalledOnce();
  });

  it("⚠️ YENİ MESAJ e-postaya bağlı DEĞİL — sıklığı gürültü yaratırdı", async () => {
    await bildirimGonder(girdi({ tur: BILDIRIM_TURLERI.YENI_MESAJ }));

    expect(prismaMock.notification.create).toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("adım revizyonu da yalnız uygulama içi", async () => {
    await bildirimGonder(girdi({ tur: BILDIRIM_TURLERI.ADIM_REVIZYON }));
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("e-posta adresi yoksa gönderim denenmez", async () => {
    await bildirimGonder(girdi({ eposta: null }));
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("e-posta gövdesi ASGARİ veri taşır — detay için panele yönlendirir", async () => {
    await bildirimGonder(girdi());

    const mesaj = sendMailMock.mock.calls[0][0];
    expect(mesaj.text).toContain("giriş yapın");
    // Gövde kısa: kişisel veriyi e-postaya dökmek gereksiz yayılma olurdu.
    expect(mesaj.text.length).toBeLessThan(300);
  });
});

describe("toplu gönderim", () => {
  it("biri patlarsa DİĞERLERİ yine denenir", async () => {
    prismaMock.notification.create
      .mockRejectedValueOnce(new Error("db"))
      .mockResolvedValue({ id: "n2" });

    await topluBildirimGonder([girdi({ userId: "a" }), girdi({ userId: "b" })]);

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
  });
});

describe("okundu işaretleme", () => {
  it("⚠️ HER ZAMAN oturum sahibiyle sınırlı", async () => {
    await okunduIsaretle("u1", ["n1", "baskasinin-bildirimi"]);

    const where = prismaMock.notification.updateMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.readAt).toBeNull();
    expect(where.id.in).toEqual(["n1", "baskasinin-bildirimi"]);
  });

  it("id verilmezse TÜMÜ okundu sayılır", async () => {
    await okunduIsaretle("u1");

    const where = prismaMock.notification.updateMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.id).toBeUndefined();
  });
});

describe("okunmamış sayısı", () => {
  it("yalnız okunmamışları sayar", async () => {
    prismaMock.notification.count.mockResolvedValue(3);

    expect(await okunmamisSayisi("u1")).toBe(3);
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
    });
  });
});
