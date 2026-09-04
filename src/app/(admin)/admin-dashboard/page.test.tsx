// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

// #165: LogoutButton/UnreadBadge mock'ları #146'da sayfa header'ı AppShell'e
// taşınınca ölü kaldı (sayfa artık ikisini de import etmiyor); kaldırıldı.

import AdminDashboard from "./page";

type SahteKullanici = {
  id: string;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  accountStatus: "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED";
  emailVerified?: string | null;
  studentProfile?: unknown;
};

/**
 * Sahte sunucu.
 *
 * ⚠️ ARAMA VE FİLTRE ARTIK SUNUCUDA — testin de öyle davranması gerekiyor.
 * Önceden stub tüm listeyi dönüyordu ve sayfa kendi içinde süzüyordu; o
 * dünyada "filtre yalnız bekleyenleri gösterir" testi istemci mantığını
 * ölçüyordu. Artık ölçtüğü şey doğru olan: sayfa SUNUCUDAN DOĞRU KATEGORİYİ
 * İSTİYOR ve gelen listeyi bir daha elemeden gösteriyor.
 *
 * Sayaçlar TAM listeden hesaplanıyor — sayfadan bağımsız oldukları iddiası
 * burada da korunuyor.
 */
function kategoriSuz<T extends SahteKullanici>(users: T[], kategori: string): T[] {
  switch (kategori) {
    case "PENDING":
    case "APPROVED":
    case "GRADUATED":
    case "REJECTED":
      return users.filter((u) => u.role === "STUDENT" && u.accountStatus === kategori);
    case "MENTOR":
      return users.filter((u) => u.role === "MENTOR" && u.accountStatus !== "PENDING");
    case "MENTOR_BASVURU":
      return users.filter((u) => u.role === "MENTOR" && u.accountStatus === "PENDING");
    case "ADMIN":
      return users.filter((u) => u.role === "ADMIN");
    case "DOGRULANMAMIS":
      return users.filter((u) => !u.emailVerified);
    case "STUDENT":
      return users.filter((u) => u.role === "STUDENT");
    default:
      return users;
  }
}

function sahteSayilar(users: SahteKullanici[]) {
  const say = (f: (u: SahteKullanici) => boolean) => users.filter(f).length;
  return {
    total: users.length,
    studentCount: say((u) => u.role === "STUDENT"),
    activeStudents: say((u) => u.role === "STUDENT" && u.accountStatus === "APPROVED"),
    graduatedCount: say((u) => u.role === "STUDENT" && u.accountStatus === "GRADUATED"),
    pendingCount: say((u) => u.role === "STUDENT" && u.accountStatus === "PENDING"),
    rejectedCount: say((u) => u.role === "STUDENT" && u.accountStatus === "REJECTED"),
    mentorCount: say((u) => u.role === "MENTOR" && u.accountStatus !== "PENDING"),
    mentorBasvuruCount: say((u) => u.role === "MENTOR" && u.accountStatus === "PENDING"),
    adminCount: say((u) => u.role === "ADMIN"),
    dogrulanmamisCount: say((u) => !u.emailVerified),
    studentsWithoutMentor: 0,
  };
}

function sahteSunucu<T extends SahteKullanici>(users: T[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      const adres = String(url);
      if (adres.includes("/api/admin/mentors")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      const kategori =
        new URL(adres, "http://t").searchParams.get("kategori") ?? "ALL";
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          users: kategoriSuz(users, kategori),
          nextCursor: null,
          sayilar: sahteSayilar(users),
        }),
      });
    }),
  );
}

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

    await waitFor(() => {
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
    sahteSunucu(users);
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

    await waitFor(() => {
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

/**
 * #259 — doğrulama durumu admin panelinde görünmeli.
 *
 * `emailVerified` #247 ile doluyor ama hiçbir yerde gösterilmiyordu; admin
 * API'si alanı select'e bile almıyordu.
 */
describe("Admin dashboard — doğrulanmış hesap ibaresi (#259)", () => {
  type DogrulamaliUser = {
    id: string;
    email: string;
    name: string | null;
    lastName: string | null;
    role: "ADMIN" | "MENTOR" | "STUDENT";
    accountStatus: "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED";
    emailVerified: string | null;
    studentProfile?: null;
  };

  const ku = (
    id: string,
    emailVerified: string | null,
    role: DogrulamaliUser["role"] = "STUDENT",
  ): DogrulamaliUser => ({
    id,
    email: `${id}@ornek.com`,
    name: id,
    lastName: "Test",
    role,
    accountStatus: "APPROVED",
    emailVerified,
    studentProfile: null,
  });

  function stubla(users: DogrulamaliUser[]) {
    sahteSunucu(users);
  }

  beforeEach(() => vi.unstubAllGlobals());

  it("doğrulanmış hesapta olumlu ibare gösterilir", async () => {
    stubla([ku("dogrulanmis", "2026-08-21T10:00:00.000Z")]);

    renderPage();

    expect(await screen.findByText("Doğrulanmış hesap")).toBeInTheDocument();
  });

  it("doğrulanmamış hesapta uyarı ibaresi gösterilir", async () => {
    stubla([ku("dogrulanmamis", null)]);

    renderPage();

    expect(await screen.findByText("Doğrulanmamış")).toBeInTheDocument();
  });

  it("doğrulanmamış sayısı filtre sekmesinde görünür", async () => {
    stubla([
      ku("a", null),
      ku("b", null),
      ku("c", "2026-08-21T10:00:00.000Z"),
    ]);

    renderPage();

    expect(
      await screen.findByRole("button", { name: /Doğrulanmamış \(2\)/ }),
    ).toBeInTheDocument();
  });

  it("filtre yalnızca doğrulanmamışları gösterir", async () => {
    stubla([
      ku("Dogrulanmamis", null),
      ku("Dogrulanmis", "2026-08-21T10:00:00.000Z"),
    ]);

    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Doğrulanmamış/ }),
    );

    await waitFor(() => {
      expect(screen.queryByText(/Dogrulanmis Test/)).toBeNull();
    });
    expect(screen.getByText(/Dogrulanmamis Test/)).toBeInTheDocument();
  });

  it("hepsi doğrulanmışsa sekmede sayı gösterilmez", async () => {
    stubla([ku("a", "2026-08-21T10:00:00.000Z")]);

    renderPage();

    const sekme = await screen.findByRole("button", { name: /Doğrulanmamış/ });
    expect(sekme.textContent).toBe("Doğrulanmamış");
  });
});

/**
 * Sayfalama — arama/filtre sunucuya taşındı, liste imleçle uzuyor.
 *
 * Bu davranışın en sinsi kırılma biçimi SESSİZ: sayfa doğru sayfayı alıp
 * onu bir daha eleyebilir, ya da arama yalnız yüklü sayfayı tarayabilir.
 * İkisi de hata vermez, sadece "kayıt yok" gösterir.
 */
describe("Admin dashboard — sayfalama ve sunucu araması", () => {
  // ⚠️ Ad ile e-posta AYRI: `name: id` iken "id" hem satır adında hem
  // e-postada geçiyor ve `findByText` çoklu eşleşmeden patlıyordu.
  const ku = (id: string) => ({
    id,
    email: "hesap-" + id + "@ornek.com",
    name: "Kisi" + id,
    lastName: "Test",
    role: "STUDENT" as const,
    accountStatus: "APPROVED" as const,
    emailVerified: "2026-08-21T10:00:00.000Z",
    studentProfile: null,
  });

  /** İmleçli sahte sunucu: ilk sayfa + "daha var" bilgisi. */
  function sayfaliSunucu(sayfalar: ReturnType<typeof ku>[][]) {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const adres = String(url);
      if (adres.includes("/api/admin/mentors")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      const imlec = new URL(adres, "http://t").searchParams.get("cursor");
      const indeks = imlec ? Number(imlec) : 0;
      const sayfa = sayfalar[indeks] ?? [];
      const sonMu = indeks >= sayfalar.length - 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          users: sayfa,
          nextCursor: sonMu ? null : String(indeks + 1),
          // Sayaçlar yalnız ilk (imleçsiz) istekte döner.
          ...(imlec ? {} : { sayilar: sahteSayilar(sayfalar.flat()) }),
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  beforeEach(() => vi.unstubAllGlobals());

  it("son sayfada 'daha fazla yükle' GÖSTERİLMEZ", async () => {
    sayfaliSunucu([[ku("tek")]]);

    renderPage();

    await screen.findByText("Kisitek Test");
    expect(screen.queryByRole("button", { name: /daha fazla yükle/i })).toBeNull();
  });

  it("⚠️ 'daha fazla yükle' listeyi UZATIR, sıfırlamaz", async () => {
    // Yeni sayfayı mevcut listenin yerine koymak, admin'in az önce
    // gördüğü satırları kaybettirirdi.
    sayfaliSunucu([[ku("birinci")], [ku("ikinci")]]);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /daha fazla yükle/i }));

    expect(await screen.findByText("Kisiikinci Test")).toBeInTheDocument();
    expect(screen.getByText("Kisibirinci Test")).toBeInTheDocument();
  });

  it("⚠️ SAYAÇLAR SAYFAYA GÖRE DEĞİŞMEZ — ilk sayfada da toplam doğru", async () => {
    // İlk sayfada 2 kayıt var ama toplam 5. Sayaçlar yüklü listeden
    // hesaplansaydı kart 2 gösterirdi.
    sayfaliSunucu([[ku("a"), ku("b")], [ku("c"), ku("d")], [ku("e")]]);

    renderPage();

    await screen.findByText("Kisia Test");
    expect(await screen.findAllByText("5")).not.toHaveLength(0);
  });

  it("⚠️ ARAMA SUNUCUYA GİDER — istemcide süzülmez", async () => {
    const fetchMock = sayfaliSunucu([[ku("ayse")]]);

    renderPage();
    await screen.findByText("Kisiayse Test");

    const kutu = screen.getByPlaceholderText(/ara/i);
    fireEvent.change(kutu, { target: { value: "mehmet" } });

    await waitFor(
      () => {
        const gitti = fetchMock.mock.calls.some((c) =>
          String(c[0]).includes("q=mehmet"),
        );
        expect(gitti).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it("kategori sekmesi sunucuya kategori olarak gider", async () => {
    const fetchMock = sayfaliSunucu([[ku("a")]]);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Doğrulanmamış/ }));

    await waitFor(() => {
      const gitti = fetchMock.mock.calls.some((c) =>
        String(c[0]).includes("kategori=DOGRULANMAMIS"),
      );
      expect(gitti).toBe(true);
    });
  });
});
