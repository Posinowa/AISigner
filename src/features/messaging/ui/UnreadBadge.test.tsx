// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import { UnreadBadge } from "./UnreadBadge";

let mockOlayHandler: ((olay: { tip: string; sayi: number }) => void) | null = null;
let mockBagli = false;

vi.mock("./useCanliAkis", () => ({
  useCanliAkis: (onOlay: (olay: { tip: string; sayi: number }) => void) => {
    mockOlayHandler = onOlay;
    return { bagli: mockBagli };
  },
}));

describe("UnreadBadge (#329)", () => {
  beforeEach(() => {
    mockOlayHandler = null;
    mockBagli = false;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unreadCount: 0 }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("canlı akıştan okunmamış sayısı olayı gelince sayacı günceller", async () => {
    mockBagli = true;
    render(<UnreadBadge />);

    expect(screen.queryByText("5")).not.toBeInTheDocument();

    act(() => {
      mockOlayHandler?.({ tip: "okunmamis", sayi: 5 });
    });

    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("sayı 0 olduğunda rozet gizlenir", async () => {
    mockBagli = true;
    render(<UnreadBadge />);

    act(() => {
      mockOlayHandler?.({ tip: "okunmamis", sayi: 3 });
    });
    expect(screen.getByText("3")).toBeInTheDocument();

    act(() => {
      mockOlayHandler?.({ tip: "okunmamis", sayi: 0 });
    });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
