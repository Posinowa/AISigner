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
  existsMock: vi.fn(() => true),
}));
vi.mock("fs/promises", () => ({
  writeFile: (...a: unknown[]) => writeFileMock(...a),
  readFile: (...a: unknown[]) => readFileMock(...a),
  unlink: (...a: unknown[]) => unlinkMock(...a),
  mkdir: (...a: unknown[]) => mkdirMock(...a),
}));
vi.mock("fs", () => ({ existsSync: (...a: unknown[]) => existsMock(...a) }));

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
