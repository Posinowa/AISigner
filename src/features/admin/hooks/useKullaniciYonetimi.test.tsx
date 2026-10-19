// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/ConfirmDialog", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(false),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useKullaniciYonetimi } from "./useKullaniciYonetimi";

const kullanici = {
  id: "u1",
  email: "ali@example.com",
  name: "Ali",
  lastName: "Veli",
  role: "STUDENT",
  accountStatus: "PENDING",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith("/api/admin/users")) {
      return {
        ok: true,
        json: async () => ({
          users: [kullanici],
          nextCursor: null,
          sayilar: { pendingCount: 1, mentorBasvuruCount: 0, studentsWithoutMentor: 0, toplam: 1 },
        }),
      };
    }
    if (url === "/api/admin/mentors") {
      return { ok: true, json: async () => [] };
    }
    return { ok: false, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useKullaniciYonetimi", () => {
  it("ilk yüklemede kullanıcıları ve sayaçları çeker", async () => {
    const { result } = renderHook(() => useKullaniciYonetimi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loadError).toBe(false);
    expect(result.current.users).toEqual([kullanici]);
    expect(result.current.stats.pendingCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/mentors");
  });

  it("uç yanıt hatasında loadError işaretler", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    const { result } = renderHook(() => useKullaniciYonetimi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loadError).toBe(true);
    expect(result.current.users).toEqual([]);
  });

  it("filtre değişince kategori sorgu parametresine yansır", async () => {
    const { result } = renderHook(() => useKullaniciYonetimi());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilterCategory("PENDING" as never);
    });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("kategori=PENDING"))).toBe(true),
    );
  });
});
