import { describe, it, expect } from "vitest";
import { createStepSchema, updateStepSchema } from "./api";

const validBase = {
  title: "Adım",
  description: "Açıklama",
};

describe("createStepSchema — githubIssueUrl (#50)", () => {
  it("geçerli github.com issue URL'ini kabul eder", () => {
    const result = createStepSchema.safeParse({
      ...validBase,
      githubIssueUrl: "https://github.com/kullanici/repo/issues/12",
    });
    expect(result.success).toBe(true);
  });

  it("issue numarası olmayan repo URL'ini reddeder", () => {
    const result = createStepSchema.safeParse({
      ...validBase,
      githubIssueUrl: "https://github.com/kullanici/repo",
    });
    expect(result.success).toBe(false);
  });

  it("sayısal olmayan issue numarasını reddeder", () => {
    const result = createStepSchema.safeParse({
      ...validBase,
      githubIssueUrl: "https://github.com/kullanici/repo/issues/abc",
    });
    expect(result.success).toBe(false);
  });

  it("github.com olmayan domaini reddeder", () => {
    const result = createStepSchema.safeParse({
      ...validBase,
      githubIssueUrl: "https://gitlab.com/kullanici/repo/issues/12",
    });
    expect(result.success).toBe(false);
  });

  it("pull request linkini reddeder (issues değil)", () => {
    const result = createStepSchema.safeParse({
      ...validBase,
      githubIssueUrl: "https://github.com/kullanici/repo/pull/12",
    });
    expect(result.success).toBe(false);
  });

  it("bozuk URL'i reddeder", () => {
    const result = createStepSchema.safeParse({ ...validBase, githubIssueUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("null / undefined / alan yok — opsiyonel olduğu için geçerli", () => {
    expect(createStepSchema.safeParse({ ...validBase, githubIssueUrl: null }).success).toBe(true);
    expect(createStepSchema.safeParse({ ...validBase, githubIssueUrl: undefined }).success).toBe(true);
    expect(createStepSchema.safeParse(validBase).success).toBe(true);
  });
});

describe("updateStepSchema — githubIssueUrl (#50)", () => {
  it("yalnızca githubIssueUrl güncellemesi geçerli", () => {
    const result = updateStepSchema.safeParse({
      githubIssueUrl: "https://github.com/kullanici/repo/issues/1",
    });
    expect(result.success).toBe(true);
  });

  it("geçersiz URL güncellemede de reddedilir", () => {
    const result = updateStepSchema.safeParse({ githubIssueUrl: "ftp://github.com/a/b/issues/1" });
    expect(result.success).toBe(false);
  });
});
