// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

import AdminAssignmentsPage from "./page";

/**
 * Takılı kalmış kurulumun ARAYÜZDEKİ karşılığı (#483).
 *
 * ⚠️ Kurtarmanın MÜMKÜN olması yetmiyor; GÖRÜNÜR de olmalı. Kilit
 * düzeltilse bile satır dönen bir spinner göstermeye devam etseydi admin
 * "Tekrar Dene" diyebileceği bir yer bulamazdı — yani atama pratikte hâlâ
 * takılı kalırdı.
 *
 * Eski davranış: `githubStatus === "PROVISIONING"` olan her satır
 * "Kuruluyor..." + hiçbir düğme. Süreç yeniden başladığında bu SONSUZA DEK
 * böyle kalıyordu ve sayfa durmadan yoklama yapıyordu.
 */
function atama(over: Record<string, unknown> = {}) {
  return {
    assignmentId: "ap-1",
    studentUserId: "u-1",
    studentName: "Test Öğrenci",
    studentEmail: "t@example.com",
    team: null,
    mentors: [],
    projectTemplateId: "pt-1",
    projectTitle: "Proje",
    projectDifficulty: "EASY",
    assignmentStatus: "IN_PROGRESS",
    githubRepoUrl: null,
    githubStatus: "PROVISIONING",
    provisionedAt: null,
    kurulumTakildi: false,
    totalSteps: 3,
    completedSteps: 0,
    progressPercentage: 0,
    duraklamaMetni: null,
    lastActivity: null,
    roadmapId: "r-1",
    roadmapStatus: "PUBLISHED",
    ...over,
  };
}

function stubla(atamalar: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      const adres = String(url);
      if (adres.includes("/api/admin/assignments")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            // ⚠️ Anahtar `atamalar` — `assignments` DEĞİL. İlk sürümde
            // yanlış yazdım ve bileşen `undefined.some` ile çöktü.
            atamalar,
            nextCursor: null,
            sayaclar: { toplam: atamalar.length, kurulu: 0, kurulmamis: 0 },
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }),
  );
}

function bas() {
  return render(
    <ConfirmDialogProvider>
      <AdminAssignmentsPage />
    </ConfirmDialogProvider>,
  );
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("takılı kurulumun görünürlüğü (#483)", () => {
  it("⚠️ TAKILI satır KURTARMA DÜĞMESİ gösterir — spinner değil", async () => {
    stubla([atama({ kurulumTakildi: true })]);

    bas();

    expect(
      await screen.findByText(/Kurulum Yarıda Kaldı — Tekrar Dene/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Kuruluyor\.\.\./)).toBeNull();
  });

  it("TAZE kurulum spinner gösterir — canlı iş kurtarma önerilmemeli", async () => {
    stubla([atama({ kurulumTakildi: false })]);

    bas();

    expect(await screen.findByText(/Kuruluyor\.\.\./)).toBeInTheDocument();
    expect(screen.queryByText(/Tekrar Dene/)).toBeNull();
  });

  it("ERROR ayrı metnini korur — iki durum karıştırılmamalı", async () => {
    // "Yarıda kaldı" (süreç öldü) ile "başarısız" (iş hata verdi) farklı
    // şeyler; admin hangisini gördüğünü bilmeli.
    stubla([atama({ githubStatus: "ERROR", kurulumTakildi: false })]);

    bas();

    expect(
      await screen.findByText(/Kurulum Başarısız — Tekrar Dene/),
    ).toBeInTheDocument();
  });

  it("⚠️ TAKILI satır YOKLAMAYI TETİKLEMEZ — sonsuz istek döngüsü olmasın", async () => {
    /*
     * ⚠️ HAM `setTimeout` UYKUSU KULLANMAYIN.
     *
     * İlk sürüm `await new Promise(r => setTimeout(r, 1200))` ile bekliyordu
     * ve CI'da patladı: o uyku sırasında Next'in `use-intersection`'ı
     * (`next/link` prefetch, `requestIdleCallback` üzerinden) act() DIŞINDA
     * setState yapıyor. #325 act uyarılarını sert hataya çevirdiği için
     * TESTLER GEÇTİĞİ HÂLDE süreç 1 ile çıkıyordu.
     *
     * Sahte zamanlayıcı hem bunu çözüyor hem de testi hızlandırıyor:
     * gerçek 4 sn'lik yoklama aralığını beklemeden ileri sarıyoruz.
     */
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      stubla([atama({ kurulumTakildi: true })]);

      bas();
      await screen.findByText(/Kurulum Yarıda Kaldı/);

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const ilkSayi = fetchMock.mock.calls.length;

      // Yoklama aralığı 4 sn; fazlasıyla ileri sarıyoruz.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(fetchMock.mock.calls.length).toBe(ilkSayi);
    } finally {
      vi.useRealTimers();
    }
  });
});
