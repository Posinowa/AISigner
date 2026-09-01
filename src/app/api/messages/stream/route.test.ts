// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, aboneOlMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  aboneOlMock: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

vi.mock("@/features/messaging/server/canli-akis", () => ({
  aboneOl: (...args: unknown[]) => aboneOlMock(...args),
}));

import { GET } from "./route";

describe("GET /api/messages/stream (#329)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yetkisiz kullanıcıya guard yanıtı döner", async () => {
    requireAuthMock.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: "yetkisiz" }), { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
    expect(aboneOlMock).not.toHaveBeenCalled();
  });

  it("oturum açmış kullanıcıya SSE başlıklarıyla 200 döner ve abone kaydeder", async () => {
    const unsubscribe = vi.fn();
    aboneOlMock.mockReturnValue(unsubscribe);

    requireAuthMock.mockResolvedValue({
      authorized: true,
      session: { user: { id: "user-1", role: "STUDENT" } },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");

    expect(aboneOlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
      }),
    );
  });
});
