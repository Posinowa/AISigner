// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #218 — entegrasyon modu göstergesi.
 *
 * En kritik nokta GİZLİLİK: bu uç yalnızca "yapılandırılmış mı" sorusunu
 * yanıtlamalı; token veya hesap adı sızmamalı.
 */

const { authMock, configMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  configMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({ requireAuth: (...a: unknown[]) => authMock(...a) }));
vi.mock("@/features/github/server/client", () => ({
  readGitHubConfig: () => configMock(),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    authorized: true,
    session: { user: { id: "a", role: "ADMIN" } },
  });
  configMock.mockReturnValue(null);
});

describe("github-status — yetki", () => {
  it("ADMIN olmayan erişemez", async () => {
    authMock.mockResolvedValue({
      authorized: false,
      response: new Response(null, { status: 403 }),
    });

    expect((await GET()).status).toBe(403);
  });

  it("yalnızca ADMIN rolü istenir", async () => {
    await GET();
    expect(authMock).toHaveBeenCalledWith("ADMIN");
  });
});

describe("github-status — mod", () => {
  it("token yoksa gercek=false", async () => {
    configMock.mockReturnValue(null);

    const g = await (await GET()).json();

    expect(g.gercek).toBe(false);
  });

  it("token varsa gercek=true", async () => {
    configMock.mockReturnValue({ token: "gizli-token", owner: "Posinowa" });

    const g = await (await GET()).json();

    expect(g.gercek).toBe(true);
  });
});

describe("github-status — gizlilik", () => {
  it("token ve hesap adı SIZMAZ", async () => {
    configMock.mockReturnValue({ token: "cok-gizli-token", owner: "Posinowa" });

    const metin = await (await GET()).text();

    expect(metin).not.toContain("cok-gizli-token");
    expect(metin).not.toContain("Posinowa");
  });

  it("yanıt yalnızca gercek alanını taşır", async () => {
    configMock.mockReturnValue({ token: "t", owner: "o" });

    const g = await (await GET()).json();

    expect(Object.keys(g)).toEqual(["gercek"]);
  });
});
