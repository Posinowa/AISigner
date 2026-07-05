import { describe, it, expect } from "vitest";
import {
  createTemplateSchema,
  updateTemplateSchema,
  createStepSchema,
  updateStepSchema,
} from "./api";

const templateBase = {
  title: "Proje",
  description: "Açıklama",
  difficulty: "EASY" as const,
};

const stepBase = {
  title: "Adım",
  description: "Açıklama",
};

describe("createTemplateSchema — githubRepoUrl (#49)", () => {
  it("geçerli github.com URL'ini kabul eder", () => {
    const result = createTemplateSchema.safeParse({
      ...templateBase,
      githubRepoUrl: "https://github.com/kullanici/repo",
    });
    expect(result.success).toBe(true);
  });

  it("github.com olmayan domaini reddeder", () => {
    const result = createTemplateSchema.safeParse({
      ...templateBase,
      githubRepoUrl: "https://gitlab.com/kullanici/repo",
    });
    expect(result.success).toBe(false);
  });

  it("bozuk URL'i reddeder", () => {
    const result = createTemplateSchema.safeParse({
      ...templateBase,
      githubRepoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("sadece domain (repo yolu yok) reddedilir", () => {
    const result = createTemplateSchema.safeParse({
      ...templateBase,
      githubRepoUrl: "https://github.com",
    });
    expect(result.success).toBe(false);
  });

  it("#83: repo kökünden daha derin yolları reddeder (tree/issues/pull)", () => {
    for (const url of [
      "https://github.com/kullanici/repo/tree/main",
      "https://github.com/kullanici/repo/issues/1",
      "https://github.com/kullanici/repo/pull/1",
      "https://github.com/kullanici/repo/blob/main/README.md",
    ]) {
      expect(createTemplateSchema.safeParse({ ...templateBase, githubRepoUrl: url }).success).toBe(
        false,
      );
    }
  });

  it("#83: yalnızca tam repo kökünü (owner/repo) kabul eder", () => {
    expect(
      createTemplateSchema.safeParse({
        ...templateBase,
        githubRepoUrl: "https://github.com/kullanici/repo",
      }).success,
    ).toBe(true);
  });

  it("#83: sondaki / repo kökü kabulünü bozmaz", () => {
    expect(
      createTemplateSchema.safeParse({
        ...templateBase,
        githubRepoUrl: "https://github.com/kullanici/repo/",
      }).success,
    ).toBe(true);
  });

  it("http (https değil) reddedilir", () => {
    const result = createTemplateSchema.safeParse({
      ...templateBase,
      githubRepoUrl: "http://github.com/kullanici/repo",
    });
    expect(result.success).toBe(false);
  });

  it("null / undefined / alan yok — opsiyonel olduğu için geçerli", () => {
    expect(createTemplateSchema.safeParse({ ...templateBase, githubRepoUrl: null }).success).toBe(true);
    expect(createTemplateSchema.safeParse({ ...templateBase, githubRepoUrl: undefined }).success).toBe(true);
    expect(createTemplateSchema.safeParse(templateBase).success).toBe(true);
  });
});

describe("updateTemplateSchema — githubRepoUrl (#49)", () => {
  it("yalnızca githubRepoUrl güncellemesi (diğer alanlar opsiyonel) geçerli", () => {
    const result = updateTemplateSchema.safeParse({
      githubRepoUrl: "https://github.com/kullanici/repo",
    });
    expect(result.success).toBe(true);
  });

  it("geçersiz URL güncellemede de reddedilir", () => {
    const result = updateTemplateSchema.safeParse({ githubRepoUrl: "ftp://github.com/a/b" });
    expect(result.success).toBe(false);
  });
});

describe("createStepSchema — githubIssueUrl (#50)", () => {
  it("geçerli github.com issue URL'ini kabul eder", () => {
    const result = createStepSchema.safeParse({
      ...stepBase,
      githubIssueUrl: "https://github.com/kullanici/repo/issues/12",
    });
    expect(result.success).toBe(true);
  });

  it("issue numarası olmayan repo URL'ini reddeder", () => {
    const result = createStepSchema.safeParse({
      ...stepBase,
      githubIssueUrl: "https://github.com/kullanici/repo",
    });
    expect(result.success).toBe(false);
  });

  it("sayısal olmayan issue numarasını reddeder", () => {
    const result = createStepSchema.safeParse({
      ...stepBase,
      githubIssueUrl: "https://github.com/kullanici/repo/issues/abc",
    });
    expect(result.success).toBe(false);
  });

  it("github.com olmayan domaini reddeder", () => {
    const result = createStepSchema.safeParse({
      ...stepBase,
      githubIssueUrl: "https://gitlab.com/kullanici/repo/issues/12",
    });
    expect(result.success).toBe(false);
  });

  it("pull request linkini reddeder (issues değil)", () => {
    const result = createStepSchema.safeParse({
      ...stepBase,
      githubIssueUrl: "https://github.com/kullanici/repo/pull/12",
    });
    expect(result.success).toBe(false);
  });

  it("bozuk URL'i reddeder", () => {
    const result = createStepSchema.safeParse({ ...stepBase, githubIssueUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("null / undefined / alan yok — opsiyonel olduğu için geçerli", () => {
    expect(createStepSchema.safeParse({ ...stepBase, githubIssueUrl: null }).success).toBe(true);
    expect(createStepSchema.safeParse({ ...stepBase, githubIssueUrl: undefined }).success).toBe(true);
    expect(createStepSchema.safeParse(stepBase).success).toBe(true);
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
