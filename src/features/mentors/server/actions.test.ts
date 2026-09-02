// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #367 — MENTÖRÜN ÖĞRENCİLERİ İKİ YOLDAN GELİR.
 *
 * Bulunan hata: `getMentorStudents` yalnız bireysel `MentorAssignment` bağına
 * bakıyordu. #332 ile mentör TAKIMA da atanabiliyor ve takım üyeleriyle
 * arasında bireysel bir kayıt YOK — takım mentörü kendi panelinde hiçbir şey
 * göremiyordu. Yetki katmanı doğruydu (API 200 dönüyordu); eksik olan liste
 * sorgusuydu.
 *
 * Bu testler sorgunun İKİ dalı da içerdiğini kilitliyor.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findMany: vi.fn(), findFirst: vi.fn() } },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getMentorStudents, getStudentDetail } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.user.findFirst.mockResolvedValue(null);
});

describe("getMentorStudents — kapsam", () => {
  it("bireysel VE takım bağını birlikte sorar", async () => {
    await getMentorStudents("men-1");

    const where = prismaMock.user.findMany.mock.calls[0][0].where;
    const [bireysel, takim] = where.studentProfile.OR;

    expect(where.role).toBe("STUDENT");
    expect(bireysel.mentorAssignments.some.mentorId).toBe("men-1");
    expect(takim.teamMemberships.some.team.mentors.some.mentorId).toBe("men-1");
  });

  it("AYRILMIŞ takım üyesi listeye girmez", async () => {
    // Ayrılan üye artık mentörün öğrencisi değil; üyelik satırı geçmiş için
    // duruyor ama sorgu `leftAt: null` ile daraltmalı.
    await getMentorStudents("men-1");

    const where = prismaMock.user.findMany.mock.calls[0][0].where;
    expect(where.studentProfile.OR[1].teamMemberships.some.leftAt).toBeNull();
  });

  it("takım üyeliklerini de çeker — panelde takım gösterilebilsin", async () => {
    await getMentorStudents("men-1");

    // Sorgu şifre hash'i sızdırmamak için `select`'e çevrildi (#370);
    // takım üyeliği hâlâ profil altından çekiliyor.
    const secim = prismaMock.user.findMany.mock.calls[0][0].select;
    const uyelikler = secim.studentProfile.include.teamMemberships;

    expect(uyelikler.where.leftAt).toBeNull();
    expect(uyelikler.select.team.select.name).toBe(true);
  });

  it("DB hatasını YUTMAZ — boş liste 'öğrenci yok' gibi görünürdü", async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error("db down"));

    await expect(getMentorStudents("men-1")).rejects.toThrow("db down");
  });
});

/**
 * #370 — LİSTE DÜZELDİ AMA DETAY 404 VERİYORDU.
 *
 * #367 `getMentorStudents`'i iki dallı yaptı; takım mentörü öğrencileri
 * panelinde görmeye başladı. `getStudentDetail` bireysel bağa bakmayı
 * sürdürdüğü için o listeden tıklanan bağlantı "öğrenci bulunamadı" dönüyordu
 * — yani yarım düzeltilmiş bir özellik canlıya çıkmıştı.
 */
describe("getStudentDetail — kapsam (#370)", () => {
  it("bireysel VE takım bağını birlikte sorar", async () => {
    await getStudentDetail("ogr-1", "men-1");

    const where = prismaMock.user.findFirst.mock.calls[0][0].where;
    const [bireysel, takim] = where.studentProfile.OR;

    expect(where.role).toBe("STUDENT");
    expect(bireysel.mentorAssignments.some.mentorId).toBe("men-1");
    expect(takim.teamMemberships.some.team.mentors.some.mentorId).toBe("men-1");
  });

  it("AYRILMIŞ takım üyesinin detayı açılmaz", async () => {
    await getStudentDetail("ogr-1", "men-1");
    const where = prismaMock.user.findFirst.mock.calls[0][0].where;
    expect(where.studentProfile.OR[1].teamMemberships.some.leftAt).toBeNull();
  });
});

/**
 * ⚠️ ŞİFRE HASH'İ SIZDIRMA.
 *
 * İki fonksiyon da `include` kullanıyordu; `include` User'ın TÜM sütunlarını
 * döndürür ve `password` (argon2 hash) mentör panelinin JSON yanıtıyla
 * istemciye kadar gidiyordu. `getAllUsers` aynı sebeple zaten `select`
 * kullanıyor, bu ikisi atlanmıştı.
 */
describe("şifre hash'i sızdırılmaz", () => {
  it("getMentorStudents select kullanır ve password İSTEMEZ", async () => {
    await getMentorStudents("men-1");

    const cagri = prismaMock.user.findMany.mock.calls[0][0];
    expect(cagri.select).toBeDefined();
    expect(cagri.include).toBeUndefined();
    expect(cagri.select.password).toBeUndefined();
    expect(cagri.select.email).toBe(true);
  });

  it("getStudentDetail select kullanır ve password İSTEMEZ", async () => {
    await getStudentDetail("ogr-1", "men-1");

    const cagri = prismaMock.user.findFirst.mock.calls[0][0];
    expect(cagri.select).toBeDefined();
    expect(cagri.include).toBeUndefined();
    expect(cagri.select.password).toBeUndefined();
    expect(cagri.select.studentProfile).toBeDefined();
  });
});
