import { describe, it, expect } from "vitest";
import { createTemplateSchema, updateTemplateSchema } from "./api";

const validBase = {
  title: "Proje",
  description: "Açıklama",
  difficulty: "EASY" as const,
};

describe("createTemplateSchema — githubRepoUrl (#49)", () => {
  it("geçerli github.com URL'ini kabul eder", () => {
    const result = createTemplateSchema.safeParse({
      ...validBase,
      githubRepoUrl: "https://github.com/kullanici/repo",
    });
    expect(result.success).toBe(true);
  });

  it("github.com olmayan domaini reddeder", () => {
    const result = createTemplateSchema.safeParse({
      ...validBase,
      githubRepoUrl: "https://gitlab.com/kullanici/repo",
    });
    expect(result.success).toBe(false);
  });

  it("bozuk URL'i reddeder", () => {
    const result = createTemplateSchema.safeParse({
      ...validBase,
      githubRepoUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("sadece domain (repo yolu yok) reddedilir", () => {
    const result = createTemplateSchema.safeParse({
      ...validBase,
      githubRepoUrl: "https://github.com",
    });
    expect(result.success).toBe(false);
  });

  it("http (https değil) reddedilir", () => {
    const result = createTemplateSchema.safeParse({
      ...validBase,
      githubRepoUrl: "http://github.com/kullanici/repo",
    });
    expect(result.success).toBe(false);
  });

  it("null / undefined / alan yok — opsiyonel olduğu için geçerli", () => {
    expect(createTemplateSchema.safeParse({ ...validBase, githubRepoUrl: null }).success).toBe(true);
    expect(createTemplateSchema.safeParse({ ...validBase, githubRepoUrl: undefined }).success).toBe(true);
    expect(createTemplateSchema.safeParse(validBase).success).toBe(true);
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
