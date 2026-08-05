import { describe, it, expect, beforeEach, vi } from "vitest";

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
