// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanliAkis, type CanliOlay } from "./useCanliAkis";

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, cb: (e: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  removeEventListener(event: string, cb: (e: MessageEvent) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((l) => l !== cb);
    }
  }

  close() {
    this.closed = true;
  }

  emit(event: string, data: unknown) {
    const list = this.listeners[event] || [];
    const me = { data: JSON.stringify(data) } as MessageEvent;
    for (const cb of list) cb(me);
  }
}

describe("useCanliAkis hook (#329)", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("EventSource bağlantısı açar ve onopen olduğunda bagli=true döner", () => {
    const onOlay = vi.fn();
    const { result } = renderHook(() => useCanliAkis(onOlay));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/messages/stream");
    expect(result.current.bagli).toBe(false);

    act(() => {
      MockEventSource.instances[0].onopen?.();
    });

    expect(result.current.bagli).toBe(true);
  });

  it("olay geldiğinde onOlay geri çağrısını tetikler", () => {
    const onOlay = vi.fn();
    renderHook(() => useCanliAkis(onOlay));

    const instance = MockEventSource.instances[0];
    const testOlay: CanliOlay = {
      tip: "mesaj",
      mesajId: "m1",
      gonderenId: "g1",
      icerik: "selam",
      createdAt: new Date().toISOString(),
    };

    act(() => {
      instance.emit("mesaj", testOlay);
    });

    expect(onOlay).toHaveBeenCalledWith(testOlay);
  });

  it("hata durumunda bagli=false olur", () => {
    const onOlay = vi.fn();
    const { result } = renderHook(() => useCanliAkis(onOlay));

    act(() => {
      MockEventSource.instances[0].onopen?.();
    });
    expect(result.current.bagli).toBe(true);

    act(() => {
      MockEventSource.instances[0].onerror?.();
    });
    expect(result.current.bagli).toBe(false);
  });

  it("unmount edildiğinde bağlantıyı kapatır", () => {
    const onOlay = vi.fn();
    const { unmount } = renderHook(() => useCanliAkis(onOlay));

    const instance = MockEventSource.instances[0];
    expect(instance.closed).toBe(false);

    unmount();
    expect(instance.closed).toBe(true);
  });
});
