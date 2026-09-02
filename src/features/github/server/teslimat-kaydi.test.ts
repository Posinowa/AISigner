// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Webhook teslimat kaydı temizliği (#378).
 *
 * `ProcessedWebhook` tekrar işlemeyi önlüyor (#326) ama hiç temizlenmiyordu:
 * tablo yalnızca büyüyordu.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { processedWebhook: { deleteMany: vi.fn() } },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { teslimatKayitlariniTemizle, SAKLAMA_GUN } from "./teslimat-kaydi";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.processedWebhook.deleteMany.mockResolvedValue({ count: 0 });
});

describe("fırsatçı temizlik", () => {
  it("HER webhook'ta çalışmaz — her isteğe DELETE eklemek olurdu", async () => {
    vi.spyOn(Math, "random").mockReturnValue(1);

    await teslimatKayitlariniTemizle();

    expect(prismaMock.processedWebhook.deleteMany).not.toHaveBeenCalled();
  });

  it("ara sıra süresi geçenleri siler", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    await teslimatKayitlariniTemizle();

    const where = prismaMock.processedWebhook.deleteMany.mock.calls[0][0].where;
    expect(where.createdAt.lt).toBeInstanceOf(Date);
  });

  it("saklama penceresi GitHub tekrar denemelerinden UZUN", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const once = Date.now();

    await teslimatKayitlariniTemizle();

    const sinir = prismaMock.processedWebhook.deleteMany.mock.calls[0][0].where.createdAt.lt;
    const gun = (once - sinir.getTime()) / 86_400_000;
    // Pencere kısa olsaydı temizlik idempotens korumasını delerdi.
    expect(Math.round(gun)).toBe(SAKLAMA_GUN);
    expect(SAKLAMA_GUN).toBeGreaterThanOrEqual(3);
  });

  it("HATA YUTULUR — bakım işi webhook'u düşürmemeli", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    prismaMock.processedWebhook.deleteMany.mockRejectedValue(new Error("db down"));

    await expect(teslimatKayitlariniTemizle()).resolves.toBeUndefined();
  });
});
