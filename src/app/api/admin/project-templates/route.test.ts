import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: { projectTemplate: { create: vi.fn() } },
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

function authAdmin() {
  requireAuthMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "admin-1", role: "ADMIN" } },
  });
}
function postReq(body: unknown) {
  return new Request("http://test/api/admin/project-templates", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  title: "Proje",
  description: "Açıklama",
  difficulty: "EASY",
  track: ["React"],
};

describe("POST /api/admin/project-templates — githubRepoUrl (#49)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.projectTemplate.create.mockResolvedValue({ id: "pt-1" });
  });

  it("geçerli github.com URL'i ile 201 döner", async () => {
    authAdmin();

    const res = await POST(
      postReq({ ...validBody, githubRepoUrl: "https://github.com/kullanici/repo" }),
    );

    expect(res.status).toBe(201);
    expect(prismaMock.projectTemplate.create).toHaveBeenCalledOnce();
    const arg = prismaMock.projectTemplate.create.mock.calls[0][0];
    expect(arg.data.githubRepoUrl).toBe("https://github.com/kullanici/repo");
  });

  it("geçersiz URL ile 400 döner, create çağrılmaz", async () => {
    authAdmin();

    const res = await POST(postReq({ ...validBody, githubRepoUrl: "not-a-url" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.githubRepoUrl).toBeTruthy();
    expect(prismaMock.projectTemplate.create).not.toHaveBeenCalled();
  });

  it("githubRepoUrl belirtilmeden 201 döner (opsiyonel)", async () => {
    authAdmin();

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(201);
  });
});
