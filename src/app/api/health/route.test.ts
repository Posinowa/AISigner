import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $queryRaw: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET } from "./route";

describe("health route (#189)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DB erişilebilirse → 200 status:ok", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
  });

  it("DB hatasında → 500 status:error", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.status).toBe("error");
    // ham hata mesajı sızmamalı
    expect(JSON.stringify(json)).not.toContain("connection refused");
  });
});
