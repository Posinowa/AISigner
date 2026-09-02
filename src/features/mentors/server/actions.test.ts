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
  prismaMock: { user: { findMany: vi.fn() } },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getMentorStudents } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([]);
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

    const include = prismaMock.user.findMany.mock.calls[0][0].include;
    const uyelikler = include.studentProfile.include.teamMemberships;

    expect(uyelikler.where.leftAt).toBeNull();
    expect(uyelikler.select.team.select.name).toBe(true);
  });

  it("DB hatasını YUTMAZ — boş liste 'öğrenci yok' gibi görünürdü", async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error("db down"));

    await expect(getMentorStudents("men-1")).rejects.toThrow("db down");
  });
});
