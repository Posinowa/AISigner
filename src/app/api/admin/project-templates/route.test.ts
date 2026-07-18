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

describe("POST /api/admin/project-templates — duplicate title (#112)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aynı title ile ikinci şablonda 409 döner", async () => {
    authAdmin();
    prismaMock.projectTemplate.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed on title"), { code: "P2002" }),
    );

    const res = await POST(postReq(validBody));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("Bu başlıkta bir proje şablonu zaten var.");
  });

  it("P2002 dışındaki DB hataları 500 olarak kalır", async () => {
    authAdmin();
    prismaMock.projectTemplate.create.mockRejectedValue(new Error("connection lost"));

    const res = await POST(postReq(validBody));

    expect(res.status).toBe(500);
  });
});
