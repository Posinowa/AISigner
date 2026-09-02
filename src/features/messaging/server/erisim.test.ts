// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Konuşma erişim kontrolü (#370).
 *
 * ⚠️ BAĞ İKİ YOLDAN GELİR. #332 ile mentör TAKIMA da atanabiliyor ve takım
 * üyeleriyle arasında bireysel bir `MentorAssignment` kaydı YOK. Yalnız
 * bireysel bağa bakan sürüm, takım mentörü ile üyesinin birbirine mesaj
 * göndermesini 403 ile engelliyordu.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    studentProfile: { findFirst: vi.fn() },
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { verifyConversationAccess } from "./erisim";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT" });
  prismaMock.studentProfile.findFirst.mockResolvedValue(null);
});

describe("kendine mesaj", () => {
  it("kendine sinyal/mesaj YOK — sorgu bile atılmaz", async () => {
    expect(await verifyConversationAccess("u1", "u1", "STUDENT")).toBe(false);
    expect(prismaMock.studentProfile.findFirst).not.toHaveBeenCalled();
  });
});

describe("ADMIN", () => {
  it("var olan herkesle konuşabilir", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u2" });
    expect(await verifyConversationAccess("admin", "u2", "ADMIN")).toBe(true);
  });

  it("olmayan kullanıcıya izin yok", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await verifyConversationAccess("admin", "yok", "ADMIN")).toBe(false);
  });
});

describe("takım bağı (#370)", () => {
  it("mentör dalı bireysel VE takım bağını birlikte sorar", async () => {
    await verifyConversationAccess("men-1", "ogr-1", "MENTOR");

    const where = prismaMock.studentProfile.findFirst.mock.calls[0][0].where;
    const [bireysel, takim] = where.OR;

    expect(where.userId).toBe("ogr-1");
    expect(bireysel.mentorAssignments.some.mentorId).toBe("men-1");
    expect(takim.teamMemberships.some.team.mentors.some.mentorId).toBe("men-1");
  });

  it("AYRILMIŞ üye dahil değil — takımdan çıkarmanın anlamı kalmalı", async () => {
    await verifyConversationAccess("men-1", "ogr-1", "MENTOR");
    const where = prismaMock.studentProfile.findFirst.mock.calls[0][0].where;
    expect(where.OR[1].teamMemberships.some.leftAt).toBeNull();
  });

  it("öğrenci dalı da takım mentörünü kapsar", async () => {
    await verifyConversationAccess("ogr-1", "men-1", "STUDENT");

    // İkinci çağrı: "karşı taraf benim mentörüm mü"
    const where = prismaMock.studentProfile.findFirst.mock.calls[1][0].where;
    expect(where.userId).toBe("ogr-1");
    expect(where.OR[1].teamMemberships.some.team.mentors.some.mentorId).toBe("men-1");
  });

  it("takım bağı VARSA izin verilir", async () => {
    prismaMock.studentProfile.findFirst.mockResolvedValueOnce({ id: "sp-1" });
    expect(await verifyConversationAccess("men-1", "ogr-1", "MENTOR")).toBe(true);
  });

  it("hiçbir bağ yoksa 403 — yabancı mentör giremez", async () => {
    expect(await verifyConversationAccess("yabanci", "ogr-1", "MENTOR")).toBe(false);
  });
});

describe("ADMIN karşı taraf", () => {
  it("herkes admin'e yazabilir", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    expect(await verifyConversationAccess("ogr-1", "admin", "STUDENT")).toBe(true);
  });
});
