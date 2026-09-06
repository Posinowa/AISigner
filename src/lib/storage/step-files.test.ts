import { describe, it, expect, beforeEach, vi } from "vitest";

// Bu birim test yerel-disk branch'ini kapsar (CI'da bağımlılıksız).
//
// GCS branch'i manuel bir emülatörle uçtan uca doğrulandı (fake-gcs-server):
//   docker run -d --name fake-gcs -p 4443:4443 fsouza/fake-gcs-server -scheme http -port 4443
//   curl -X POST "http://localhost:4443/storage/v1/b?project=test" -d '{"name":"aisigner-test"}'
//   GCS_BUCKET=aisigner-test GCS_API_ENDPOINT=http://localhost:4443 GOOGLE_CLOUD_PROJECT=test \
//     tsx -e "<saveStepFile→readStepFile→deleteStepFile round-trip>"
// Sonuç: save/read/delete + eksik-dosya→null uçtan uca ✓.

// #197: fs mock'lanır — testler gerçek diske dokunmaz.
const { writeFileMock, readFileMock, unlinkMock, mkdirMock, existsMock } = vi.hoisted(() => ({
  writeFileMock: vi.fn(),
  readFileMock: vi.fn(),
  unlinkMock: vi.fn(),
  mkdirMock: vi.fn(),
  existsMock: vi.fn<(...args: unknown[]) => boolean>(() => true),
}));
vi.mock("fs/promises", () => ({
  writeFile: (path: string, data: unknown) => writeFileMock(path, data),
  readFile: (path: string) => readFileMock(path),
  unlink: (path: string) => unlinkMock(path),
  mkdir: (path: string, options?: unknown) => mkdirMock(path, options),
}));
vi.mock("fs", () => ({ existsSync: (path: string) => existsMock(path) }));

// GCS_BUCKET tanımsız (test ortamı) → yerel disk branch'i doğrulanır.
import { saveStepFile, readStepFile, deleteStepFile, usingGcs } from "./step-files";

describe("step-files storage — yerel disk branch (#197)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GCS_BUCKET yoksa usingGcs() → false", () => {
    expect(usingGcs()).toBe(false);
  });

  it("save → writeFile çağrılır", async () => {
    existsMock.mockReturnValue(true);
    await saveStepFile("abc.png", Buffer.from("x"), "image/png");
    expect(writeFileMock).toHaveBeenCalledOnce();
  });

  it("read → dosya varsa buffer, yoksa null", async () => {
    existsMock.mockReturnValue(true);
    readFileMock.mockResolvedValue(Buffer.from("data"));
    expect(await readStepFile("abc.png")).toEqual(Buffer.from("data"));

    // Dosya yoksa readFile hiç çağrılmaz, null döner.
    vi.clearAllMocks();
    existsMock.mockReturnValue(false);
    expect(await readStepFile("yok.png")).toBeNull();
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("delete → dosya varsa unlink, yoksa sessiz geçer", async () => {
    existsMock.mockReturnValue(true);
    await deleteStepFile("abc.png");
    expect(unlinkMock).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    existsMock.mockReturnValue(false);
    await deleteStepFile("yok.png");
    expect(unlinkMock).not.toHaveBeenCalled();
  });
});

describe("yol kaçışı kapısı (`storedName` doğrulaması)", () => {
  /*
   * `storedName` bugün HER İKİ çağırma yerinde de sunucuda üretiliyor
   * (`${stepId}_${uniqueId}${safeExt}` ve `${randomUUID()}.${uzanti}`), yani
   * kullanıcıdan gelen bir yol YOK. Kapı yine de `blob.ts` çekirdeğinde
   * çünkü sözleşme "adı ver, nereye yazacağımı ben bilirim" ve o ad
   * `path.join` ile birleşiyor.
   *
   * ⚠️ GCS tarafı da aynı kapıdan geçiyor: orada `path.join` yok ama önek
   * DÜZ METİN birleştiriliyor (`gcsPrefix + storedName`), yani
   * `steps/../gizli` aynı kaçışı bucket içinde yapardı.
   */
  beforeEach(() => vi.clearAllMocks());

  // ⚠️ Ters bölü ÇİFT kaçırılmalı: TS kaynağındaki "..\win.png" JS'te
  // "..win.png" olur — meşru bir dosya adı, yani test sessizce anlamsızlaşır.
  // Windows'ta `path.join` ters bölüyü de ayraç sayıyor, kapı onu da kesmeli.
  const KOTU = [
    "../gizli.png",
    "a/../../b.png",
    "alt/dizin.png",
    "..\\win.png",
    "..",
    ".",
  ];

  it("⚠️ dizin dışına çıkan ad KAYDEDİLMEZ", async () => {
    for (const ad of KOTU) {
      await expect(saveStepFile(ad, Buffer.from("x"), "image/png")).rejects.toThrow(
        /Geçersiz depolama adı/,
      );
    }
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("okuma da reddedilir — kaçış OKUMA yönünde de işe yarardı", async () => {
    await expect(readStepFile("../../.env")).rejects.toThrow(/Geçersiz depolama adı/);
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it("silme de reddedilir — yanlış dosyayı silmek geri alınamaz", async () => {
    await expect(deleteStepFile("../baskasinin.png")).rejects.toThrow(
      /Geçersiz depolama adı/,
    );
    expect(unlinkMock).not.toHaveBeenCalled();
  });

  it("meşru adlar ETKİLENMEZ — üretimdeki iki kalıp da geçer", async () => {
    existsMock.mockReturnValue(true);

    // files/route.ts: `${stepId}_${uniqueId}${safeExt}`
    await saveStepFile("step-1_a1b2c3.png", Buffer.from("x"), "image/png");
    // avatar/route.ts: `${randomUUID()}.${uzanti}`
    await saveStepFile("3f2504e0-4f89-11d3-9a0c-0305e82c3301.webp", Buffer.from("x"), "image/webp");

    expect(writeFileMock).toHaveBeenCalledTimes(2);
  });
});
