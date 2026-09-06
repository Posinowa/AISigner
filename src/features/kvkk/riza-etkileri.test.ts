// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #352 — rıza değişikliğinin türev veriye etkisi.
 *
 * Kilitlenen garantiler:
 *   1. Rıza geri alınınca AI türev kayıtları SİLİNİR (KVKK m.11). Yalnız
 *      "artık kullanmıyoruz" demek yetmiyordu — #328 zaten kullanmıyordu ama
 *      veri duruyordu, yani en kötü kombinasyon.
 *   2. Silme başarısız olsa bile FIRLATMAZ: rızayı geri alamamak, türev
 *      kaydın bir süre daha durmasından ağır bir ihlaldir.
 *   3. Rıza verilince EKSİK analiz üretilir — yoksa rızasız başvurup sonradan
 *      onay veren mentör eşleştirmeden kalıcı olarak dışlanırdı.
 *   4. Var olan analiz YENİDEN üretilmez (boş yere kota harcamasın).
 */

const { prismaMock, uretMock } = vi.hoisted(() => ({
  prismaMock: {
    mentorAnalysis: { deleteMany: vi.fn() },
    profileAnalysis: { deleteMany: vi.fn() },
    mentorProfile: { findUnique: vi.fn() },
  },
  uretMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/features/ai/server/mentor-analysis-store", () => ({
  generateAndPersistMentorAnalysis: uretMock,
}));

import { rizaGeriAlindiginda, rizaVerildiginde } from "./riza-etkileri";

const profil = (analysis: { id: string } | null) => ({
  id: "mp1",
  title: "Senior Backend",
  company: "Acme",
  yearsExperience: 8,
  seniority: "senior",
  expertise: ["backend"],
  capacity: 2,
  weeklyHours: 5,
  motivation: "Öğretmeyi seviyorum",
  mentoringStyle: "Uygulamalı",
  city: "İstanbul",
  analysis,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.mentorAnalysis.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.profileAnalysis.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.mentorProfile.findUnique.mockResolvedValue(profil(null));
  uretMock.mockResolvedValue({});
});

describe("rizaGeriAlindiginda", () => {
  it("mentör ve stajyer analizlerini KULLANICIYA GÖRE siler", async () => {
    await rizaGeriAlindiginda("u1");

    expect(prismaMock.mentorAnalysis.deleteMany).toHaveBeenCalledWith({
      where: { mentorProfile: { userId: "u1" } },
    });
    expect(prismaMock.profileAnalysis.deleteMany).toHaveBeenCalledWith({
      where: { studentProfile: { userId: "u1" } },
    });
  });

  it("mentör silme patlarsa STAJYER silmesi yine denenir", async () => {
    prismaMock.mentorAnalysis.deleteMany.mockRejectedValue(new Error("db"));

    await rizaGeriAlindiginda("u1");

    expect(prismaMock.profileAnalysis.deleteMany).toHaveBeenCalled();
  });

  it("silme başarısız olsa da FIRLATMAZ", async () => {
    // Rızayı geri alamamak, türev kaydın durmasından ağır bir ihlal olurdu.
    prismaMock.mentorAnalysis.deleteMany.mockRejectedValue(new Error("db"));
    prismaMock.profileAnalysis.deleteMany.mockRejectedValue(new Error("db"));

    await expect(rizaGeriAlindiginda("u1")).resolves.toBeUndefined();
  });
});

describe("rizaVerildiginde", () => {
  it("analizi olmayan mentör için ÜRETİR", async () => {
    await rizaVerildiginde("u1");

    expect(uretMock).toHaveBeenCalledWith("mp1", {
      title: "Senior Backend",
      company: "Acme",
      yearsExperience: 8,
      seniority: "senior",
      expertise: ["backend"],
      capacity: 2,
      weeklyHours: 5,
      motivation: "Öğretmeyi seviyorum",
      mentoringStyle: "Uygulamalı",
      city: "İstanbul",
    });
  });

  it("analizi OLAN mentör için yeniden üretmez", async () => {
    prismaMock.mentorProfile.findUnique.mockResolvedValue(profil({ id: "ma1" }));

    await rizaVerildiginde("u1");

    expect(uretMock).not.toHaveBeenCalled();
  });

  it("mentör profili olmayan kullanıcı için hiçbir şey yapmaz", async () => {
    // Stajyer ve admin de bu uçtan rıza veriyor.
    prismaMock.mentorProfile.findUnique.mockResolvedValue(null);

    await rizaVerildiginde("u1");

    expect(uretMock).not.toHaveBeenCalled();
  });

  it("boş şirket/şehir alanları undefined olarak geçer", async () => {
    // Şemada nullable; AI girdisi `undefined` bekliyor. `null` geçilseydi
    // prompt'ta "null" yazardı.
    prismaMock.mentorProfile.findUnique.mockResolvedValue({
      ...profil(null),
      company: null,
      city: null,
    });

    await rizaVerildiginde("u1");

    expect(uretMock).toHaveBeenCalledWith(
      "mp1",
      expect.objectContaining({ company: undefined, city: undefined }),
    );
  });

  it("AI hatası FIRLATMAZ — rıza kaydı geri alınmamalı", async () => {
    uretMock.mockRejectedValue(new Error("model yok"));

    await expect(rizaVerildiginde("u1")).resolves.toBeUndefined();
  });
});
