// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { useAtamaIlerlemesi } from "./useAtamaIlerlemesi";

const atama = { assignmentId: "a1", studentName: "Ali Veli", projectTitle: "Portföy" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith("/api/admin/assignments")) {
      return {
        ok: true,
        json: async () => ({
          atamalar: [atama],
          nextCursor: null,
          sayaclar: { toplam: 1, kurulu: 0, kurulmamis: 1, ortalamaIlerleme: 0 },
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useAtamaIlerlemesi", () => {
  it("atamaları ve sayaçları yükler", async () => {
    const { result } = renderHook(() => useAtamaIlerlemesi());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.assignments).toEqual([atama]);
    expect(result.current.sayaclar.toplam).toBe(1);
    expect(result.current.totalAssigned).toBe(1);
  });

  it("sunucu hatasında error işaretler ve bildirim gösterir", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/admin/assignments")) {
        return { ok: false, json: async () => ({ error: "Sunucu hatası" }) };
      }
      return { ok: true, json: async () => ({}) };
    });
    const { result } = renderHook(() => useAtamaIlerlemesi());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Sunucu hatası");
    expect(result.current.assignments).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("Sunucu hatası");
  });
});
