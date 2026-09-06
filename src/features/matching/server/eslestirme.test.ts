// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #328 — mentör önerisi.
 *
 * Kilitlenen garantiler:
 *   1. Bu modül hiçbir ATAMA yapmaz — karar admin'de kalır.
 *   2. Rızası olmayan kimsenin verisi Vertex'e gitmez (öğrenci VE mentör).
 *   3. Model uydurma bir mentör kimliği döndürürse ARAYÜZE SIZMAZ.
 *   4. AI çuvallarsa uydurma sıralamaya düşülmez.
 */

const { prismaMock, siralaMock, rizaMock, limitMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), count: vi.fn() },
    mentorAnalysis: { findMany: vi.fn() },
  },
  siralaMock: vi.fn(),
  rizaMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/metrics", () => ({ incrementCounter: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: limitMock }),
}));
vi.mock("@/features/kvkk/riza", () => ({ profilSahibininRizasiVar: rizaMock }));
vi.mock("@/features/ai/server/mentor-matching", () => ({ mentorleriSirala: siralaMock }));

import { mentorOnerisiUret } from "./eslestirme";
import { PROMPT_SURUMU, YEDEK_SURUM } from "@/lib/ai/uretim-kokeni";

const mentorAnalizi = (
  id: string,
  rizali = true,
  role = "MENTOR",
  uretimSurumu: string | null = PROMPT_SURUMU,
) => ({
  uretimSurumu,
  level: "SENIOR",
  summary: "Backend ağırlıklı",
  strengths: ["mimari"],
  technicalTracks: ["backend"],
  idealStudentProfile: "Backend öğrenmek isteyen başlangıç seviyesi",
  matchingNotes: ["sabırlı"],
  mentorProfile: {
    user: {
      id,
      name: "Mentor",
      lastName: id.toUpperCase(),
      email: `${id}@ornek.test`,
      role,
      aiConsentAt: rizali ? new Date() : null,
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({
    role: "STUDENT",
    studentProfile: {
      id: "sp1",
      experienceLevel: "BEGINNER",
      interests: ["backend"],
      goals: "API yazmayı öğrenmek",
      profileAnalysis: {
        summary: "Yeni başlıyor",
        strengths: ["meraklı"],
        developmentAreas: ["test"],
        technicalTracks: ["backend"],
      },
      mentorAssignments: [],
    },
  });
  prismaMock.user.count.mockResolvedValue(2);
  prismaMock.mentorAnalysis.findMany.mockResolvedValue([
    mentorAnalizi("m1"),
    mentorAnalizi("m2"),
  ]);
  rizaMock.mockResolvedValue(true);
  limitMock.mockResolvedValue({ allowed: true, remaining: 10, retryAfterSeconds: 0 });
  siralaMock.mockResolvedValue({
    oneriler: [
      { mentorId: "m1", uyum: "guclu", gerekce: "Backend örtüşüyor", cekince: null },
    ],
  });
});

const cagir = () => mentorOnerisiUret({ studentUserId: "u1", adminUserId: "a1" });

describe("mentorOnerisiUret", () => {
  it("öneriyi mentör bilgileriyle birlikte döner", async () => {
    const s = await cagir();

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.oneriler).toEqual([
      expect.objectContaining({
        mentorId: "m1",
        email: "m1@ornek.test",
        uyum: "guclu",
        zatenAtanmis: false,
      }),
    ]);
  });

  it("zaten atanmış mentörü işaretler", async () => {
    // Arayüz ona "Ata" düğmesi göstermemeli.
    prismaMock.user.findUnique.mockResolvedValue({
      role: "STUDENT",
      studentProfile: {
        id: "sp1",
        experienceLevel: "BEGINNER",
        interests: [],
        goals: null,
        profileAnalysis: null,
        mentorAssignments: [{ mentorId: "m1" }],
      },
    });

    const s = await cagir();

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.oneriler[0].zatenAtanmis).toBe(true);
  });

  it("profil analizi yoksa yine çalışır", async () => {
    // Analizi olmayan öğrenci de eşleştirilebilmeli; ham profil yeterli.
    prismaMock.user.findUnique.mockResolvedValue({
      role: "STUDENT",
      studentProfile: {
        id: "sp1",
        experienceLevel: "BEGINNER",
        interests: ["backend"],
        goals: null,
        profileAnalysis: null,
        mentorAssignments: [],
      },
    });

    expect((await cagir()).ok).toBe(true);
    expect(siralaMock).toHaveBeenCalledWith(
      expect.objectContaining({ analizOzeti: null, guclüYonler: [] }),
      expect.anything(),
    );
  });
});

describe("KVKK kapıları", () => {
  it("ÖĞRENCİNİN rızası yoksa AI'ya HİÇ gitmez", async () => {
    rizaMock.mockResolvedValue(false);

    const s = await cagir();

    expect(s).toEqual({ ok: false, neden: "riza-yok" });
    expect(siralaMock).not.toHaveBeenCalled();
    // Aday sorgusu bile yapılmamalı: rıza kapısı en önde.
    expect(prismaMock.mentorAnalysis.findMany).not.toHaveBeenCalled();
  });

  it("rızası olmayan MENTÖR sıralamaya girmez", async () => {
    // Mentörün analizi de kişisel veridir ve o da yurt dışına gider.
    prismaMock.mentorAnalysis.findMany.mockResolvedValue([
      mentorAnalizi("m1", true),
      mentorAnalizi("m2", false),
    ]);

    const s = await cagir();

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.degerlendirilen).toBe(1);
    expect(s.rizasiOlmayan).toBe(1);
    const [, adaylar] = siralaMock.mock.calls[0];
    expect(adaylar.map((a: { mentorId: string }) => a.mentorId)).toEqual(["m1"]);
  });

  it("eleme SESSİZ değil — sayılar döndürülür", async () => {
    // "En uygun 3 mentör", adayların yarısı elenmişken yanıltıcı olur.
    prismaMock.user.count.mockResolvedValue(5);
    prismaMock.mentorAnalysis.findMany.mockResolvedValue([mentorAnalizi("m1")]);

    const s = await cagir();

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s).toMatchObject({ degerlendirilen: 1, analiziOlmayan: 4, rizasiOlmayan: 0 });
  });

  it("hiç aday kalmazsa AI çağrılmaz", async () => {
    prismaMock.mentorAnalysis.findMany.mockResolvedValue([mentorAnalizi("m1", false)]);

    expect(await cagir()).toEqual({ ok: false, neden: "aday-yok" });
    expect(siralaMock).not.toHaveBeenCalled();
  });

  it("rolü MENTOR olmayanın analizi sıralamaya girmez", async () => {
    // Rol sonradan değişmiş olabilir.
    prismaMock.mentorAnalysis.findMany.mockResolvedValue([
      mentorAnalizi("m1", true, "STUDENT"),
    ]);

    expect(await cagir()).toEqual({ ok: false, neden: "aday-yok" });
  });
});

describe("dayanıklılık", () => {
  it("modelin UYDURDUĞU mentör kimliği elenir", async () => {
    // Prompt "uydurma" diyor ama bu bir talimat, garanti değil.
    siralaMock.mockResolvedValue({
      oneriler: [
        { mentorId: "m1", uyum: "guclu", gerekce: "gerçek", cekince: null },
        { mentorId: "olmayan-mentor", uyum: "guclu", gerekce: "uydurma", cekince: null },
      ],
    });

    const s = await cagir();

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.oneriler.map((o) => o.mentorId)).toEqual(["m1"]);
  });

  it("AI çuvallarsa UYDURMA sıralamaya düşmez", async () => {
    siralaMock.mockRejectedValue(new Error("model yok"));

    const s = await cagir();

    expect(s).toMatchObject({ ok: false, neden: "ai-hatasi" });
  });

  it("model boş liste dönerse bu bir hata değildir", async () => {
    // "Listeyi doldurmak için zayıf aday önerme" talimatının sonucu.
    siralaMock.mockResolvedValue({ oneriler: [] });

    const s = await cagir();

    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.oneriler).toEqual([]);
  });

  it("saatlik tavan dolduysa AI çağrılmaz", async () => {
    limitMock.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 60 });

    expect(await cagir()).toEqual({ ok: false, neden: "tavan-doldu" });
    expect(siralaMock).not.toHaveBeenCalled();
  });

  it("öğrenci yoksa / STUDENT değilse çalışmaz", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "MENTOR", studentProfile: null });
    expect(await cagir()).toEqual({ ok: false, neden: "ogrenci-yok" });

    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await cagir()).toEqual({ ok: false, neden: "ogrenci-yok" });
  });

  it("profili tamamlanmamış öğrenci için 'profil-yok'", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: "STUDENT", studentProfile: null });
    expect(await cagir()).toEqual({ ok: false, neden: "profil-yok" });
  });
});

/**
 * #501 — YEDEK KÖKENLİ ANALİZ KARAR GİRDİSİ OLAMAZ.
 *
 * ⚠️ Bu dosya zaten "YEDEK SIRALAMAYA DÜŞMÜYORUZ; uydurulmuş bir liste,
 * admin'in gerçek bir öneriden ayırt edemeyeceği bir karar girdisi olurdu"
 * diyordu — ama kural yalnız SIRALAMA çıktısına uygulanıyordu. Bir katman
 * yukarıda, model yanıt veremediğinde `MentorAnalysis` başvurunun kendisinden
 * türetilmiş bir metinle KALICI kaydediliyor (#494) ve `idealStudentProfile`
 * sıralama prompt'una gerçek analiz gibi giriyordu.
 */
describe("yedek kökenli analizler (#501)", () => {
  it("⚠️ yedek analizli mentör SIRALAMAYA GİRMEZ", async () => {
    prismaMock.mentorAnalysis.findMany.mockResolvedValue([
      mentorAnalizi("m1"),
      mentorAnalizi("m2", true, "MENTOR", YEDEK_SURUM),
    ]);

    await mentorOnerisiUret({ studentUserId: "s1", adminUserId: "a1" });

    const adaylar = siralaMock.mock.calls[0][1];
    expect(adaylar.map((a: { mentorId: string }) => a.mentorId)).toEqual(["m1"]);
  });

  /*
   * ⚠️ ELEME SESSİZ DEĞİL (#328). "En uygun 3" ifadesi adayların yarısı
   * elenmişken yanıltıcı olur; admin neyin arasından seçildiğini bilmeli.
   */
  it("⚠️ elenen yedek sayısı DÖNDÜRÜLÜR ve 'analizi yok' ile karışmaz", async () => {
    prismaMock.mentorAnalysis.findMany.mockResolvedValue([
      mentorAnalizi("m1"),
      mentorAnalizi("m2", true, "MENTOR", YEDEK_SURUM),
    ]);

    const s = await mentorOnerisiUret({ studentUserId: "s1", adminUserId: "a1" });

    if (!s.ok) throw new Error("beklenen: ok");
    expect(s.yedekAnalizli).toBe(1);
    expect(s.analiziOlmayan).toBe(0);
    expect(s.degerlendirilen).toBe(1);
  });

  /*
   * ⚠️ `null` KÖKEN ELENMEZ. O "bilinmiyor" demek — köken sütunları
   * eklenmeden önce üretilmiş kayıtlar. Onları da elemek, bugün
   * veritabanındaki TÜM analizleri düşürüp özelliği çalışmaz hâle getirirdi.
   */
  it("⚠️ kökeni BİLİNMEYEN analiz elenmez — özellik kendini kapatmasın", async () => {
    prismaMock.mentorAnalysis.findMany.mockResolvedValue([
      mentorAnalizi("m1", true, "MENTOR", null),
      mentorAnalizi("m2", true, "MENTOR", null),
    ]);

    const s = await mentorOnerisiUret({ studentUserId: "s1", adminUserId: "a1" });

    if (!s.ok) throw new Error("beklenen: ok");
    expect(s.yedekAnalizli).toBe(0);
    expect(s.degerlendirilen).toBe(2);
  });

  it("aday KALMAZSA öneri üretilmez — yedeklerle sıralama yapılmaz", async () => {
    prismaMock.mentorAnalysis.findMany.mockResolvedValue([
      mentorAnalizi("m1", true, "MENTOR", YEDEK_SURUM),
    ]);

    const s = await mentorOnerisiUret({ studentUserId: "s1", adminUserId: "a1" });

    expect(s).toMatchObject({ ok: false, neden: "aday-yok" });
    expect(siralaMock).not.toHaveBeenCalled();
  });

  /*
   * ⚠️ ÖĞRENCİNİN KENDİ ANALİZİ DE YEDEK OLABİLİR. Yedekse prompt'a konserve
   * bir metin girer ve sıralama, öğrenciyi hiç tanımayan bir özete göre
   * yapılır. Alanlar "analiz yok" durumunu zaten destekliyor.
   */
  it("⚠️ öğrencinin YEDEK analizi sıralama girdisine KONMAZ", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      role: "STUDENT",
      studentProfile: {
        id: "sp1",
        experienceLevel: "BEGINNER",
        interests: ["backend"],
        goals: "API yazmayı öğrenmek",
        profileAnalysis: {
          summary: "Yeni başlıyor",
          strengths: ["meraklı"],
          developmentAreas: ["test"],
          technicalTracks: ["backend"],
          uretimSurumu: YEDEK_SURUM,
        },
        mentorAssignments: [],
      },
    });

    await mentorOnerisiUret({ studentUserId: "s1", adminUserId: "a1" });

    const ogrenci = siralaMock.mock.calls[0][0];
    expect(ogrenci.analizOzeti).toBeNull();
    expect(ogrenci.guclüYonler).toEqual([]);
    expect(ogrenci.gelisimAlanlari).toEqual([]);
    expect(ogrenci.teknikAlanlar).toEqual([]);
    // Beyan edilen veri (analiz DEĞİL) yerinde kalmalı — yoksa öneri hiç
    // bilgisiz üretilirdi.
    expect(ogrenci.ilgiAlanlari).toEqual(["backend"]);
  });

  it("öğrencinin GERÇEK analizi sıralama girdisine girer", async () => {
    await mentorOnerisiUret({ studentUserId: "s1", adminUserId: "a1" });

    const ogrenci = siralaMock.mock.calls[0][0];
    expect(ogrenci.analizOzeti).toBe("Yeni başlıyor");
  });
});
