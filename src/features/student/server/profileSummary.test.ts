// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * #282 — AI profil özeti zaman aşımı sözleşmesi.
 *
 * Gemini istemcisinde timeout yok; yavaşlarsa veya asılırsa çağrı süresiz
 * beklerdi. Mevcut yedek (mock özet) yalnızca hata FIRLATILDIĞINDA devreye
 * giriyordu — asılma durumunda değil.
 *
 * Süre bilerek cömert: kart artık akış sınırının içinde, yani sayfa
 * beklemiyor. Zaman aşımının işi hızı zorlamak değil, sonsuz asılmayı
 * önlemek. Bu testler o dengeyi kilitliyor.
 */

const { analizMock } = vi.hoisted(() => ({ analizMock: vi.fn() }));

// unstable_cache önbelleği testler arasında sonucu taşımasın: doğrudan çağır.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.mock("@/features/ai/server/profile-analysis", () => ({
  analyzeStudentProfile: analizMock,
}));
// #321: KVKK rizasi — bu dosya AI ozet davranisini olcuyor, riza VAR kabul.
vi.mock("@/features/kvkk/riza", () => ({ aiRizasiVar: () => Promise.resolve(true) }));

import { getProfileSummary } from "./profileSummary";

const girdi = {
  experienceLevel: "BEGINNER",
  interests: ["web"],
  goals: "hedef",
  userId: "k1",
};

const gercekSonuc = {
  level: "Başlangıç",
  tracks: ["Frontend"],
  summary: "GERCEK AI OZETI",
  recommendations: ["oneri"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getProfileSummary — normal yol", () => {
  it("AI zamanında yanıt verirse GERÇEK sonuç döner", async () => {
    analizMock.mockResolvedValue(gercekSonuc);

    const sonuc = await getProfileSummary(girdi);

    expect(sonuc.summary).toBe("GERCEK AI OZETI");
  });

  it("AI hata fırlatırsa yedek özete düşülür", async () => {
    analizMock.mockRejectedValue(new Error("AI patladi"));

    const sonuc = await getProfileSummary(girdi);

    expect(sonuc.summary).not.toBe("GERCEK AI OZETI");
    expect(sonuc.summary.length).toBeGreaterThan(0);
  });
});

describe("getProfileSummary — zaman aşımı", () => {
  it("AI ASILIRSA süresiz beklenmez, yedek özet döner", async () => {
    // Asıl kusur buydu: hiç çözülmeyen bir promise sayfayı sonsuza kadar
    // bekletirdi.
    analizMock.mockReturnValue(new Promise(() => {}));

    const sozVerilen = getProfileSummary(girdi);
    await vi.advanceTimersByTimeAsync(30_000);
    const sonuc = await sozVerilen;

    expect(sonuc.summary.length).toBeGreaterThan(0);
    expect(sonuc.summary).not.toBe("GERCEK AI OZETI");
  });

  it("sınırın ALTINDA dönen yavaş çağrı yine de GERÇEK sonuç verir", async () => {
    // Zaman aşımı fazla agresif olursa özellik sessizce mock'a düşer.
    // Ölçümde gerçek çağrı ~10 sn; bu testte 15 sn de geçmeli.
    analizMock.mockImplementation(
      () => new Promise((c) => setTimeout(() => c(gercekSonuc), 15_000)),
    );

    const sozVerilen = getProfileSummary(girdi);
    await vi.advanceTimersByTimeAsync(16_000);

    expect((await sozVerilen).summary).toBe("GERCEK AI OZETI");
  });

  it("zaman aşımı yedeğe düşerken uyarı loglanır", async () => {
    const uyari = vi.spyOn(console, "warn").mockImplementation(() => {});
    analizMock.mockReturnValue(new Promise(() => {}));

    const sozVerilen = getProfileSummary(girdi);
    await vi.advanceTimersByTimeAsync(30_000);
    await sozVerilen;

    expect(uyari).toHaveBeenCalled();
    uyari.mockRestore();
  });
});
