// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

// #165: LogoutButton/UnreadBadge mock'ları #146'da sayfa header'ı AppShell'e
// taşınınca ölü kaldı (sayfa artık ikisini de import etmiyor); kaldırıldı.

import AdminDashboard from "./page";

function renderPage() {
  return render(
    <ConfirmDialogProvider>
      <AdminDashboard />
    </ConfirmDialogProvider>,
  );
}

describe("Admin dashboard — fetch fail error state (#126-6 / #89-3)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("kullanıcı listesi isteği reddedilirse boş liste yerine error state render edilir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    renderPage();

    expect(await screen.findByText("Kullanıcılar yüklenemedi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tekrar dene/i })).toBeInTheDocument();
  });

  it("istek 500 dönerse de error state gösterilir (ok=false dalı)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    renderPage();

    expect(await screen.findByText("Kullanıcılar yüklenemedi")).toBeInTheDocument();
  });

  it("'Tekrar Dene' yeniden istek atar; başarılı olursa error state kalkar", async () => {
    const ok = { ok: true, json: async () => [] };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down")) // users
      .mockRejectedValueOnce(new Error("down")) // mentors
      .mockResolvedValue(ok); // retry sonrası tümü
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    const retry = await screen.findByRole("button", { name: /tekrar dene/i });
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(retry);

    await vi.waitFor(() => {
      expect(screen.queryByText("Kullanıcılar yüklenemedi")).not.toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

/**
 * #250 — mentör başvurusu admin panelinde görünmeli ve onaylanabilmeli.
 *
 * Önceden "Onay Bekleyenler" filtresi ve sayacı yalnızca STUDENT sayıyordu;
 * bir mentör başvurusu veritabanına düşse bile panelde kaybolurdu. Onay
 * butonları da yalnızca STUDENT satırlarında render ediliyordu.
 */
describe("Admin dashboard — mentör başvuruları (#250)", () => {
  type TestUser = {
    id: string;
    email: string;
    name: string | null;
    lastName: string | null;
    role: "ADMIN" | "MENTOR" | "STUDENT";
    accountStatus: "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED";
    studentProfile?: null;
  };

  const k = (
    id: string,
    role: TestUser["role"],
    accountStatus: TestUser["accountStatus"],
    name = id,
  ): TestUser => ({
    id,
    email: `${id}@ornek.com`,
    name,
    lastName: "Test",
    role,
    accountStatus,
    studentProfile: null,
  });

  function stubla(users: TestUser[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const veri = String(url).includes("/api/admin/mentors") ? [] : users;
        return Promise.resolve({ ok: true, status: 200, json: async () => veri });
      }),
    );
  }

  beforeEach(() => vi.unstubAllGlobals());

  it("bekleyen mentör başvurusu bildirim şeridiyle duyurulur", async () => {
    stubla([
      k("basvuran1", "MENTOR", "PENDING", "Ayse"),
      k("basvuran2", "MENTOR", "PENDING", "Mehmet"),
      k("ogrenci1", "STUDENT", "PENDING"),
    ]);

    renderPage();

    expect(
      await screen.findByText(/2 mentör başvurusu onay bekliyor/),
    ).toBeInTheDocument();
  });

  it("bekleyen başvuru yoksa şerit gösterilmez", async () => {
    stubla([k("mentor1", "MENTOR", "APPROVED"), k("ogrenci1", "STUDENT", "PENDING")]);

    renderPage();

    await screen.findByText("Yönetici Paneli");
    expect(screen.queryByText(/mentör başvurusu onay bekliyor/)).toBeNull();
  });

  it("bekleyen mentör 'Onay Bekleyenler' sayacına karışmaz", async () => {
    // O sayaç stajyer anlamını korumalı; başvurular ayrı kategoride.
    stubla([k("basvuran1", "MENTOR", "PENDING"), k("ogrenci1", "STUDENT", "PENDING")]);

    renderPage();

    const sekme = await screen.findByRole("button", {
      name: /Mentör Başvuruları \(1\)/,
    });
    expect(sekme).toBeInTheDocument();
  });

  it("başvuru filtresi yalnızca bekleyen mentörleri gösterir", async () => {
    stubla([
      k("basvuran1", "MENTOR", "PENDING", "Basvuran"),
      k("mentor1", "MENTOR", "APPROVED", "Onayli"),
      k("ogrenci1", "STUDENT", "PENDING", "Ogrenci"),
    ]);

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Mentör Başvuruları/ }),
    );

    await vi.waitFor(() => {
      expect(screen.queryByText(/Onayli/)).toBeNull();
    });
    expect(screen.getByText(/Basvuran/)).toBeInTheDocument();
    expect(screen.queryByText(/Ogrenci/)).toBeNull();
  });

  it("bekleyen mentör satırında Onayla butonu vardır", async () => {
    // Asıl kusur buydu: başvuru görünse bile onaylanamıyordu.
    stubla([k("basvuran1", "MENTOR", "PENDING", "Basvuran")]);

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Mentör Başvuruları/ }),
    );

    expect(
      await screen.findByTitle("Mentör Başvurusunu Onayla"),
    ).toBeInTheDocument();
    expect(screen.getByTitle("Mentör Başvurusunu Reddet")).toBeInTheDocument();
  });

  it("onaylı mentör satırında başvuru butonları yoktur", async () => {
    stubla([k("mentor1", "MENTOR", "APPROVED", "Onayli")]);

    renderPage();

    await screen.findByText(/Onayli/);
    expect(screen.queryByTitle("Mentör Başvurusunu Onayla")).toBeNull();
  });

  it("mentöre 'Mezun Et' önerilmez", async () => {
    stubla([k("basvuran1", "MENTOR", "PENDING")]);

    renderPage();

    await screen.findByText(/1 mentör başvurusu onay bekliyor/);
    expect(screen.queryByTitle("Stajı Bitir & Mezun Et")).toBeNull();
  });
});
