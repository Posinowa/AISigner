import { describe, it, expect, beforeEach, vi } from "vitest";

const { queryRawMock, loggerErrorMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));
vi.mock("@/lib/logger", () => ({ logger: { error: loggerErrorMock } }));

import { GET, dynamic, revalidate } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DB erişilebilirken 200 + sürüm/uptime döner", async () => {
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const govde = await res.json();

    expect(res.status).toBe(200);
    expect(govde.status).toBe("ok");
    expect(govde.db).toBe("connected");
    // Deploy sonrası "yeni sürüm gerçekten yayında mı?" sorusunu yanıtlayan alanlar.
    expect(govde).toHaveProperty("version");
    expect(typeof govde.uptimeSeconds).toBe("number");
  });

  it("DB düştüğünde 500 döner", async () => {
    queryRawMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));

    const res = await GET();

    expect(res.status).toBe(500);
    expect((await res.json()).db).toBe("disconnected");
  });

  it("DB hatasının DETAYINI yanıta SIZDIRMAZ (yalnız loglar)", async () => {
    // Bağlantı hataları host/port, bazen kimlik bilgisi taşır. Sağlık ucu
    // genelde kimlik doğrulamasızdır — gövdeye konmamalı.
    queryRawMock.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));

    const res = await GET();
    const ham = JSON.stringify(await res.json());

    expect(ham).not.toContain("ECONNREFUSED");
    expect(ham).not.toContain("10.0.0.5");
    expect(loggerErrorMock).toHaveBeenCalledOnce();
  });

  it("önbelleklenmez — önbellekli 'ok', DB düştüğünde yalan söylerdi", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(revalidate).toBe(0);
  });
});
