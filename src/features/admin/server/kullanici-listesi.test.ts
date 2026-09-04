// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Sayfalı kullanıcı listesi + sayaçlar.
 *
 * ⚠️ SAYFALAMA TEK BAŞINA ÜÇ ŞEYİ BOZARDI: arama yalnız yüklü sayfayı
 * tarardı, sekme filtresi yalnız yüklü sayfayı süzerdi ve paneldeki 11
 * sayaç "yüklenmiş kadarını" gösterirdi. Bu testler üçünün de sunucuya
 * taşındığını kilitliyor.
 */
const { findManyMock, groupByMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  groupByMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: findManyMock, groupBy: groupByMock, count: countMock },
  },
}));
vi.mock("@/features/bildirim/server/bildirim", () => ({
  bildirimGonder: vi.fn(),
  topluBildirimGonder: vi.fn(),
}));
vi.mock("@/lib/storage/step-files", () => ({ deleteStepFile: vi.fn() }));
vi.mock("@/features/certificate/server/certificate", () => ({
  ensureCertificateIssued: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getAllUsers, kullaniciSayilari, SAYFA_BOYUTU } from "./user";

const satir = (id: string) => ({
  id,
  email: id + "@t.com",
  name: "Ad",
  lastName: "Soyad",
  role: "STUDENT",
  accountStatus: "APPROVED",
  emailVerified: null,
  avatarFile: null,
  studentProfile: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  findManyMock.mockResolvedValue([]);
});

describe("sayfalama", () => {
  it("sayfa boyutu kadar +1 çeker — daha var mı sorusu fazladan sorgu istemesin", async () => {
    await getAllUsers();
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: SAYFA_BOYUTU + 1 }),
    );
  });

  it("⚠️ fazladan satır KIRPILIR ve nextCursor son GÖSTERİLEN satırdır", async () => {
    findManyMock.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => satir("u" + i)),
    );
    const sonuc = await getAllUsers({ limit: 3 });
    expect(sonuc.users.map((u) => u.id)).toEqual(["u0", "u1", "u2"]);
    // İmleç u3 olsaydı u2 bir daha gelirdi ya da u3 atlanırdı.
    expect(sonuc.nextCursor).toBe("u2");
  });

  it("son sayfada nextCursor null", async () => {
    findManyMock.mockResolvedValue([satir("u0"), satir("u1")]);
    const sonuc = await getAllUsers({ limit: 3 });
    expect(sonuc.users).toHaveLength(2);
    expect(sonuc.nextCursor).toBeNull();
  });

  it("⚠️ SIRALAMA İKİ ALANLI — kararsız sıra satır atlatır/tekrarlatır", async () => {
    // Aynı saniyede oluşmuş kayıtlarda yalnız createdAt ile sıralamak
    // imleçli sayfalamada bozulur.
    await getAllUsers();
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("imleç verilince cursor + skip:1 kullanılır", async () => {
    await getAllUsers({ cursor: "u9" });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "u9" }, skip: 1 }),
    );
  });

  it("imleçsiz istekte cursor GÖNDERİLMEZ", async () => {
    await getAllUsers();
    const cagri = findManyMock.mock.calls[0][0];
    expect(cagri.cursor).toBeUndefined();
    expect(cagri.skip).toBeUndefined();
  });

  it("⚠️ limit TAVANLI — istemci dev bir limitle sayfalamayı atlayamaz", async () => {
    await getAllUsers({ limit: 999999 });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: 201 }),
    );
  });

  it("limit tabanı 1 — sıfır/negatif değer sorguyu bozmasın", async () => {
    await getAllUsers({ limit: 0 });
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    findManyMock.mockClear();
    await getAllUsers({ limit: -5 });
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
  });
});

describe("filtre ve arama SUNUCUDA", () => {
  it("kategori koşulu sorguya girer", async () => {
    await getAllUsers({ kategori: "MENTOR_BASVURU" });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "MENTOR", accountStatus: "PENDING" }),
      }),
    );
  });

  it("arama koşulu sorguya girer", async () => {
    await getAllUsers({ q: "ayse" });
    expect(findManyMock.mock.calls[0][0].where.AND).toBeDefined();
  });

  it("⚠️ kategori VE arama BİRLİKTE uygulanır", async () => {
    // Biri diğerini eziyorsa "mentör başvuruları içinde ara" çalışmaz.
    await getAllUsers({ kategori: "MENTOR", q: "ayse" });
    const where = findManyMock.mock.calls[0][0].where;
    expect(where.role).toBe("MENTOR");
    expect(where.AND).toBeDefined();
  });

  it("boş arama koşul eklemez", async () => {
    await getAllUsers({ q: "   " });
    expect(findManyMock.mock.calls[0][0].where.AND).toBeUndefined();
  });

  it("⚠️ select AÇIK — password gibi alanlar istenmiyor", async () => {
    await getAllUsers();
    const cagri = findManyMock.mock.calls[0][0];
    expect(cagri.select).toBeDefined();
    expect(cagri.include).toBeUndefined();
    expect(Object.keys(cagri.select)).not.toContain("password");
  });
});

describe("sayaçlar — toplama VERİTABANINDA", () => {
  beforeEach(() => {
    groupByMock.mockResolvedValue([
      { role: "STUDENT", accountStatus: "APPROVED", _count: { _all: 5 } },
      { role: "STUDENT", accountStatus: "PENDING", _count: { _all: 3 } },
      { role: "STUDENT", accountStatus: "GRADUATED", _count: { _all: 2 } },
      { role: "STUDENT", accountStatus: "REJECTED", _count: { _all: 1 } },
      { role: "MENTOR", accountStatus: "APPROVED", _count: { _all: 4 } },
      { role: "MENTOR", accountStatus: "PENDING", _count: { _all: 2 } },
      { role: "ADMIN", accountStatus: "APPROVED", _count: { _all: 1 } },
    ]);
    countMock.mockResolvedValue(7);
  });

  it("⚠️ SATIR ÇEKİLMEZ — sayaçlar findMany kullanmaz", async () => {
    await kullaniciSayilari();
    expect(findManyMock).not.toHaveBeenCalled();
    expect(groupByMock).toHaveBeenCalledTimes(1);
  });

  it("gruplardan doğru toplamlar türer", async () => {
    const s = await kullaniciSayilari();
    expect(s.total).toBe(18);
    expect(s.studentCount).toBe(11);
    expect(s.activeStudents).toBe(5);
    expect(s.pendingCount).toBe(3);
    expect(s.graduatedCount).toBe(2);
    expect(s.rejectedCount).toBe(1);
    expect(s.adminCount).toBe(1);
  });

  it("⚠️ MENTOR sayısı BEKLEYEN BAŞVURUYU İÇERMEZ (#250)", async () => {
    const s = await kullaniciSayilari();
    expect(s.mentorCount).toBe(4);
    expect(s.mentorBasvuruCount).toBe(2);
  });

  it("doğrulanmamış sayısı emailVerified null ile sorulur", async () => {
    await kullaniciSayilari();
    expect(countMock).toHaveBeenCalledWith({ where: { emailVerified: null } });
  });

  it("⚠️ mentörsüz öğrenci İLİŞKİ üzerinden sayılır (#195 M:N)", async () => {
    await kullaniciSayilari();
    expect(countMock).toHaveBeenCalledWith({
      where: {
        role: "STUDENT",
        accountStatus: "APPROVED",
        studentProfile: { mentorAssignments: { none: {} } },
      },
    });
  });

  it("bilinmeyen bir rol/durum çifti toplamı bozmaz", async () => {
    groupByMock.mockResolvedValue([
      { role: "STUDENT", accountStatus: "APPROVED", _count: { _all: 2 } },
      { role: "MENTOR", accountStatus: "REJECTED", _count: { _all: 1 } },
    ]);
    const s = await kullaniciSayilari();
    expect(s.total).toBe(3);
    // REJECTED mentör "bekleyen değil" olduğu için mentör sayısına girer.
    expect(s.mentorCount).toBe(1);
  });
});
