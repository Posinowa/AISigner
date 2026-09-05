// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * `rotaHatasi` — API rotalarının catch bloğu için tek giriş noktası.
 *
 * ⚠️ BU MODÜL BİR ÖLÇÜMDEN DOĞDU: 70 rotanın 46'sı `console.error`
 * kullanıyordu ve `bildirSunucuHatasi` yalnız `instrumentation.ts`'teki
 * `onRequestError`'dan çağrılıyordu — o hook ise YALNIZ YAKALANMAYAN
 * hatalar için çalışıyor. Yani rotaların baskın deseni
 * (`catch { console.error(...); return 500 }`) operatöre HİÇ ulaşmıyordu.
 *
 * En kritik iddia: bu fonksiyon HİÇBİR DURUMDA FIRLATMAZ. Hata yolundan
 * çağrılıyor; kendisi patlarsa asıl hatayı gölgeler ve rota 500 yerine
 * anlaşılmaz bir çökme üretir.
 */
const { loggerMock, bildirMock, afterMock, headersMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  bildirMock: vi.fn(),
  afterMock: vi.fn(),
  headersMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/error-alerts", () => ({ bildirSunucuHatasi: bildirMock }));
vi.mock("next/server", () => ({ after: (fn: () => void) => afterMock(fn) }));
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

import { rotaHatasi } from "./api-hata";

/**
 * ⚠️ LOG ARTIK MİKRO-GÖREVDE YAZILIYOR (#491).
 *
 * İstek kimliği `headers()`'tan okunuyor ve o Next 15'te ASENKRON. Satır
 * bu yüzden bir mikro-görev sonra çıkıyor; testler iddiadan önce bir tur
 * beklemek zorunda. `after()` KULLANILMADI: o, logu yanıttan sonraya
 * ertelerdi ve süreç hemen çökerse hata satırı tamamen kaybolurdu.
 */
const bekle = async () => {
  // Zincir birden çok tur istiyor: dinamik `import("next/headers")` +
  // `await headers()` + bildirim promise'i. Tek tur yetmiyordu.
  for (let i = 0; i < 5; i++) await new Promise((c) => setTimeout(c, 0));
};

beforeEach(() => {
  vi.clearAllMocks();
  bildirMock.mockResolvedValue(undefined);
  // Varsayılan: `after` işi hemen koştursun ki bildirim gözlemlenebilsin.
  afterMock.mockImplementation((fn: () => void) => fn());
  // Varsayılan: istek bağlamı YOK (arka plan işi / test).
  headersMock.mockRejectedValue(new Error("istek bağlamı yok"));
});

/*
 * ⚠️ TESTLER ARASI ASENKRON SIZINTI. `rotaHatasi` artık iş bırakıyor
 * (kimlik okuma + bildirim); bir sonraki test başlamadan bunlar
 * boşaltılmazsa önceki testin bildirimi ötekinin sayacına düşüyor —
 * "1 bekleniyordu, 2 geldi" hatası tam olarak buydu.
 */
afterEach(async () => {
  await bekle();
});

describe("loglama", () => {
  it("kapsamı ve hatayı YAPISAL olarak loglar", async () => {
    rotaHatasi("GET /api/x", new Error("patladi"));
    await bekle();

    expect(loggerMock.error).toHaveBeenCalledWith(
      "GET /api/x",
      expect.objectContaining({ ad: "Error", mesaj: "patladi" }),
    );
  });

  it("⚠️ Error ALANLARI AÇILIR — JSON.stringify onu boş nesneye çevirirdi", async () => {
    // `logger` üretimde JSON basıyor; hatayı olduğu gibi vermek log'a
    // `{}` yazdırırdı ve mesaj tamamen kaybolurdu.
    rotaHatasi("GET /api/x", new Error("detay"));
    await bekle();

    const meta = loggerMock.error.mock.calls[0][1] as Record<string, unknown>;
    expect(meta.mesaj).toBe("detay");
    expect(typeof meta.stack).toBe("string");
  });

  it("Error olmayan değerlerde de çalışır", async () => {
    rotaHatasi("GET /api/x", "düz metin hata");
    await bekle();

    const meta = loggerMock.error.mock.calls[0][1] as Record<string, unknown>;
    expect(meta.mesaj).toBe("düz metin hata");
    expect(meta.stack).toBeUndefined();
  });
});

describe("bildirim", () => {
  it("⚠️ YAKALANAN hata da bildirilir — asıl düzeltilen boşluk bu", async () => {
    rotaHatasi("POST /api/y", new Error("patladi"));
    await bekle();

    expect(bildirMock).toHaveBeenCalledTimes(1);
  });

  it("kapsam bildirim imzasına girer — rotalar birbirini susturmasın", async () => {
    // `bildirSunucuHatasi` imzayı ad|mesaj|routePath ile kuruyor ve aynı
    // imzayı 15 dk susturuyor. routePath geçilmezse tüm rotalar tek kovaya
    // düşer ve biri diğerinin bildirimini yutar.
    rotaHatasi("POST /api/y", new Error("patladi"));
    await bekle();

    expect(bildirMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ routePath: "POST /api/y" }),
    );
  });

  it("ek bağlam geçirilebilir", async () => {
    rotaHatasi("POST /api/y", new Error("x"), { method: "POST", path: "/api/y" });
    await bekle();

    expect(bildirMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ method: "POST", path: "/api/y" }),
    );
  });

  it("⚠️ YANIT BEKLETİLMEZ — bildirim `after` ile yanıttan sonraya kalır", async () => {
    // `await` edilseydi 500 yanıtı SMTP'nin hızına bağlanırdı.
    rotaHatasi("POST /api/y", new Error("x"));
    await bekle();

    expect(afterMock).toHaveBeenCalledTimes(1);
  });
});

describe("⚠️ hiçbir durumda FIRLATMAZ", () => {
  it("`after` fırlatsa bile — istek bağlamı dışında böyle olur", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("after: istek bağlamı yok");
    });

    expect(() => rotaHatasi("GET /api/x", new Error("asil"))).not.toThrow();
  });

  it("`after` yokken bildirim yine de denenir — sessizce düşmez", async () => {
    const cagrilanlar: unknown[] = [];
    bildirMock.mockImplementation((...a: unknown[]) => {
      cagrilanlar.push(a);
      return Promise.resolve();
    });
    afterMock.mockImplementation(() => {
      throw new Error("after yok");
    });

    rotaHatasi("GET /api/x", new Error("asil"));
    await bekle();

    expect(cagrilanlar).toHaveLength(1);
  });

  it("bildirim reddederse asıl akış etkilenmez", async () => {
    bildirMock.mockRejectedValue(new Error("smtp coktu"));

    expect(() => rotaHatasi("GET /api/x", new Error("asil"))).not.toThrow();
  });

  it("senkron döner — çağıran `await` etmek zorunda değil", async () => {
    expect(rotaHatasi("GET /api/x", new Error("x"))).toBeUndefined();
  });
});

describe("rotalarda kalıntı yok", () => {
  /*
   * ⚠️ Taşımayı kilitleyen yapısal test.
   *
   * `console.error` üretimde YAPISAL LOG üretmiyor (logger üretimde JSON
   * basıyor, #314) ve bildirim zincirine hiç bağlı değil. Yeni bir rota
   * eski alışkanlıkla yazılırsa hata yine görünmez olur — bu test onu
   * kırmızıya çevirir.
   */
  it("hiçbir API rotasında console.error kalmadı", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const kok = path.join(process.cwd(), "src", "app", "api");

    const kalanlar: string[] = [];
    const gez = (dizin: string) => {
      for (const g of fs.readdirSync(dizin, { withFileTypes: true })) {
        const tam = path.join(dizin, g.name);
        if (g.isDirectory()) gez(tam);
        else if (g.name === "route.ts") {
          if (fs.readFileSync(tam, "utf8").includes("console.error(")) {
            kalanlar.push(path.relative(kok, tam).split(path.sep).join("/"));
          }
        }
      }
    };
    gez(kok);

    expect(
      kalanlar,
      "Bu rotalar `console.error` kullanıyor. `rotaHatasi(kapsam, error)` " +
        "kullanın: üretimde yapısal log üretir ve hatayı bildirim zincirine " +
        "bağlar (yakalanan hatalar aksi halde operatöre HİÇ ulaşmıyor).",
    ).toEqual([]);
  });
});

describe("istek kimliği (#491)", () => {

  it("⚠️ kimlik LOG SATIRINA girer — korelasyonun bütün amacı bu", async () => {
    headersMock.mockResolvedValue(
      new Headers({ "x-request-id": "trace-abc-12345" }),
    );

    rotaHatasi("GET /api/x", new Error("patladi"));
    await bekle();

    expect(loggerMock.error).toHaveBeenCalledWith(
      "GET /api/x",
      expect.objectContaining({ istekKimligi: "trace-abc-12345" }),
    );
  });

  it("kimlik BİLDİRİME de girer — e-postadan loga geçilebilsin", async () => {
    headersMock.mockResolvedValue(
      new Headers({ "x-request-id": "trace-abc-12345" }),
    );

    rotaHatasi("GET /api/x", new Error("patladi"));
    await bekle();

    expect(bildirMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ istekKimligi: "trace-abc-12345" }),
    );
  });

  it("⚠️ İSTEK BAĞLAMI YOKSA satır YİNE yazılır — hata logu kaybolamaz", async () => {
    // Arka plan işleri ve testler istek bağlamı dışında koşuyor;
    // korelasyon kaybolabilir ama hata görünmez olamaz.
    headersMock.mockRejectedValue(new Error("istek bağlamı yok"));

    rotaHatasi("GET /api/x", new Error("patladi"));
    await bekle();

    expect(loggerMock.error).toHaveBeenCalledWith(
      "GET /api/x",
      expect.objectContaining({ mesaj: "patladi" }),
    );
    const meta = loggerMock.error.mock.calls[0][1] as Record<string, unknown>;
    expect(meta.istekKimligi).toBeUndefined();
  });

  it("başlık yoksa kimlik alanı hiç eklenmez", async () => {
    headersMock.mockResolvedValue(new Headers());

    rotaHatasi("GET /api/x", new Error("patladi"));
    await bekle();

    const meta = loggerMock.error.mock.calls[0][1] as Record<string, unknown>;
    expect(meta.istekKimligi).toBeUndefined();
  });
});
