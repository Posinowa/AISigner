import { describe, it, expect, beforeEach, vi } from "vitest";

// GCS branch'ini test etmek için GCS_BUCKET env ayarlanır.
process.env.GCS_BUCKET = "aisigner-unit-test-bucket";

const { saveMock, downloadMock, deleteMock, bucketFileMock } = vi.hoisted(() => {
  const saveMock = vi.fn();
  const downloadMock = vi.fn();
  const deleteMock = vi.fn();
  const bucketFileMock = vi.fn<(...args: unknown[]) => { save: typeof saveMock; download: typeof downloadMock; delete: typeof deleteMock }>(() => ({
    save: saveMock,
    download: downloadMock,
    delete: deleteMock,
  }));
  return { saveMock, downloadMock, deleteMock, bucketFileMock };
});

vi.mock("@google-cloud/storage", () => {
  return {
    Storage: class {
      bucket() {
        return {
          file: (name: string) => bucketFileMock(name),
        };
      }
    },
  };
});

import { saveStepFile, readStepFile, deleteStepFile, usingGcs } from "./step-files";

describe("step-files storage — GCS branch (#197 / #201)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GCS_BUCKET tanımlıysa usingGcs() → true döner", () => {
    expect(usingGcs()).toBe(true);
  });

  it("saveStepFile → GCS file.save çağrılır", async () => {
    saveMock.mockResolvedValue(undefined);

    await saveStepFile("test.png", Buffer.from("image-content"), "image/png");

    expect(bucketFileMock).toHaveBeenCalledWith("steps/test.png");
    expect(saveMock).toHaveBeenCalledWith(Buffer.from("image-content"), {
      resumable: false,
      contentType: "image/png",
    });
  });

  it("readStepFile → dosya varsa buffer döner", async () => {
    const fakeBuffer = Buffer.from("downloaded-content");
    downloadMock.mockResolvedValue([fakeBuffer]);

    const result = await readStepFile("test.png");

    expect(bucketFileMock).toHaveBeenCalledWith("steps/test.png");
    expect(downloadMock).toHaveBeenCalledOnce();
    expect(result).toEqual(fakeBuffer);
  });

  it("readStepFile → GCS 404 hatasında null döner", async () => {
    const notFoundError = new Error("Not Found") as Error & { code: number };
    notFoundError.code = 404;
    downloadMock.mockRejectedValue(notFoundError);

    const result = await readStepFile("missing.png");

    expect(result).toBeNull();
  });

  it("readStepFile → GCS 500 veya ağ hatasında hatayı fırlatır", async () => {
    const serverError = new Error("Internal GCS Error") as Error & { code: number };
    serverError.code = 500;
    downloadMock.mockRejectedValue(serverError);

    await expect(readStepFile("error.png")).rejects.toThrow("Internal GCS Error");
  });

  it("deleteStepFile → GCS file.delete({ ignoreNotFound: true }) çağrılır", async () => {
    deleteMock.mockResolvedValue(undefined);

    await deleteStepFile("delete-me.png");

    expect(bucketFileMock).toHaveBeenCalledWith("steps/delete-me.png");
    expect(deleteMock).toHaveBeenCalledWith({ ignoreNotFound: true });
  });
});
