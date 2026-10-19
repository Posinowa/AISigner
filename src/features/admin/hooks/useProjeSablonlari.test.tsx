// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/ConfirmDialog", () => ({
  useConfirm: () => vi.fn().mockResolvedValue(false),
}));
vi.mock("@/components/ui/useModalA11y", () => ({
  useModalA11y: () => ({ current: null }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useProjeSablonlari } from "./useProjeSablonlari";

const sablon = { id: "t1", title: "Portföy Sitesi", difficulty: "EASY", track: [], description: "" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => [sablon] }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useProjeSablonlari", () => {
  it("şablonları yükler ve sayfa yükleme durumunu kapatır", async () => {
    const { result } = renderHook(() => useProjeSablonlari());

    await waitFor(() => expect(result.current.pageLoading).toBe(false));

    expect(result.current.loadError).toBe(false);
    expect(result.current.templates).toEqual([sablon]);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/project-templates");
  });

  it("yükleme hatasında loadError işaretler", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const { result } = renderHook(() => useProjeSablonlari());

    await waitFor(() => expect(result.current.pageLoading).toBe(false));

    expect(result.current.loadError).toBe(true);
    expect(result.current.templates).toEqual([]);
  });
});
