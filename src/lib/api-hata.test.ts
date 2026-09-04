// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

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
const { loggerMock, bildirMock, afterMock } = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  bildirMock: vi.fn(),
  afterMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/error-alerts", () => ({ bildirSunucuHatasi: bildirMock }));
vi.mock("next/server", () => ({ after: (fn: () => void) => afterMock(fn) }));

import { rotaHatasi } from "./api-hata";

beforeEach(() => {
  vi.clearAllMocks();
  bildirMock.mockResolvedValue(undefined);
  // Varsayılan: `after` işi hemen koştursun ki bildirim gözlemlenebilsin.
  afterMock.mockImplementation((fn: () => void) => fn());
});

describe("loglama", () => {
  it("kapsamı ve hatayı YAPISAL olarak loglar", () => {
    rotaHatasi("GET /api/x", new Error("patladi"));

    expect(loggerMock.error).toHaveBeenCalledWith(
      "GET /api/x",
      expect.objectContaining({ ad: "Error", mesaj: "patladi" }),
    );
  });

  it("⚠️ Error ALANLARI AÇILIR — JSON.stringify onu boş nesneye çevirirdi", () => {
    // `logger` üretimde JSON basıyor; hatayı olduğu gibi vermek log'a
    // `{}` yazdırırdı ve mesaj tamamen kaybolurdu.
    rotaHatasi("GET /api/x", new Error("detay"));

    const meta = loggerMock.error.mock.calls[0][1] as Record<string, unknown>;
    expect(meta.mesaj).toBe("detay");
    expect(typeof meta.stack).toBe("string");
  });

  it("Error olmayan değerlerde de çalışır", () => {
    rotaHatasi("GET /api/x", "düz metin hata");

    const meta = loggerMock.error.mock.calls[0][1] as Record<string, unknown>;
    expect(meta.mesaj).toBe("düz metin hata");
    expect(meta.stack).toBeUndefined();
  });
});

describe("bildirim", () => {
  it("⚠️ YAKALANAN hata da bildirilir — asıl düzeltilen boşluk bu", () => {
    rotaHatasi("POST /api/y", new Error("patladi"));

    expect(bildirMock).toHaveBeenCalledTimes(1);
  });

  it("kapsam bildirim imzasına girer — rotalar birbirini susturmasın", () => {
    // `bildirSunucuHatasi` imzayı ad|mesaj|routePath ile kuruyor ve aynı
    // imzayı 15 dk susturuyor. routePath geçilmezse tüm rotalar tek kovaya
    // düşer ve biri diğerinin bildirimini yutar.
    rotaHatasi("POST /api/y", new Error("patladi"));

    expect(bildirMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ routePath: "POST /api/y" }),
    );
  });

  it("ek bağlam geçirilebilir", () => {
    rotaHatasi("POST /api/y", new Error("x"), { method: "POST", path: "/api/y" });

    expect(bildirMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ method: "POST", path: "/api/y" }),
    );
  });

  it("⚠️ YANIT BEKLETİLMEZ — bildirim `after` ile yanıttan sonraya kalır", () => {
    // `await` edilseydi 500 yanıtı SMTP'nin hızına bağlanırdı.
    rotaHatasi("POST /api/y", new Error("x"));

    expect(afterMock).toHaveBeenCalledTimes(1);
  });
});

describe("⚠️ hiçbir durumda FIRLATMAZ", () => {
  it("`after` fırlatsa bile — istek bağlamı dışında böyle olur", () => {
    afterMock.mockImplementation(() => {
      throw new Error("after: istek bağlamı yok");
    });

    expect(() => rotaHatasi("GET /api/x", new Error("asil"))).not.toThrow();
  });

  it("`after` yokken bildirim yine de denenir — sessizce düşmez", () => {
    const cagrilanlar: unknown[] = [];
    bildirMock.mockImplementation((...a: unknown[]) => {
      cagrilanlar.push(a);
      return Promise.resolve();
    });
    afterMock.mockImplementation(() => {
      throw new Error("after yok");
    });

    rotaHatasi("GET /api/x", new Error("asil"));

    expect(cagrilanlar).toHaveLength(1);
  });

  it("bildirim reddederse asıl akış etkilenmez", () => {
    bildirMock.mockRejectedValue(new Error("smtp coktu"));

    expect(() => rotaHatasi("GET /api/x", new Error("asil"))).not.toThrow();
  });

  it("senkron döner — çağıran `await` etmek zorunda değil", () => {
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
