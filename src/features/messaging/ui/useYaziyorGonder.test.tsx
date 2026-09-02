// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * "Yazıyor..." gönderen kanca (#354).
 *
 * ⚠️ ASIL MESELE KISMA. Kısılmasaydı hızlı yazan biri saniyede 5–6 istek
 * üretirdi — kozmetik bir gösterge, mesaj göndermekten pahalı olurdu.
 */

import { useYaziyorGonder } from "./useYaziyorGonder";

const govde = (cagriNo: number) =>
  JSON.parse((fetchMock.mock.calls[cagriNo][1] as RequestInit).body as string);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("kısma", () => {
  it("arka arkaya tuş vuruşları TEK istek üretir", () => {
    const { result } = renderHook(() => useYaziyorGonder("u2"));

    act(() => {
      for (let i = 0; i < 20; i++) result.current.yazdiginiBildir();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(govde(0)).toEqual({ to: "u2", yaziyor: true });
  });

  it("pencere dolunca sinyal TAZELENİR — gösterge sönmemeli", () => {
    const { result } = renderHook(() => useYaziyorGonder("u2"));

    act(() => result.current.yazdiginiBildir());
    act(() => {
      vi.advanceTimersByTime(3100);
      result.current.yazdiginiBildir();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("durdurma", () => {
  it("durdurma sinyali gönderir", () => {
    const { result } = renderHook(() => useYaziyorGonder("u2"));

    act(() => result.current.yazdiginiBildir());
    act(() => result.current.durdur());

    expect(govde(1)).toEqual({ to: "u2", yaziyor: false });
  });

  it("hiç yazılmadıysa durdurma isteği ATILMAZ", () => {
    const { result } = renderHook(() => useYaziyorGonder("u2"));

    act(() => result.current.durdur());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("durdurduktan sonra yeniden yazmak BEKLETMEZ", () => {
    const { result } = renderHook(() => useYaziyorGonder("u2"));

    act(() => result.current.yazdiginiBildir());
    act(() => result.current.durdur());
    // Kısma sayacı sıfırlanmasaydı gösterge 3 sn boyunca geri gelmezdi.
    act(() => result.current.yazdiginiBildir());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(govde(2)).toEqual({ to: "u2", yaziyor: true });
  });

  it("partner değişince ESKİ konuşmaya durdurma gider", () => {
    const { result, rerender } = renderHook(({ p }) => useYaziyorGonder(p), {
      initialProps: { p: "u2" as string | null },
    });

    act(() => result.current.yazdiginiBildir());
    rerender({ p: "u3" });

    // Yoksa terk edilen konuşmada 7 sn daha "yazıyor" görünürdük.
    expect(govde(1)).toEqual({ to: "u2", yaziyor: false });
  });

  it("bileşen giderken sinyal temizlenir", () => {
    const { result, unmount } = renderHook(() => useYaziyorGonder("u2"));

    act(() => result.current.yazdiginiBildir());
    unmount();

    expect(govde(1)).toEqual({ to: "u2", yaziyor: false });
  });
});

describe("dayanıklılık", () => {
  it("partner yoksa istek atılmaz", () => {
    const { result } = renderHook(() => useYaziyorGonder(null));
    act(() => result.current.yazdiginiBildir());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ağ hatası ÇÖKME ÜRETMEZ — mesajlaşma etkilenmemeli", () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useYaziyorGonder("u2"));

    expect(() => act(() => result.current.yazdiginiBildir())).not.toThrow();
  });
});
