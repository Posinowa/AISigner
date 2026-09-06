// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ProjectTemplate, StudentProfile } from "@prisma/client";

/**
 * #295 — proje öneri sözleşmesi.
 *
 * Asıl kusur şuydu: model listede olmayan bir `projectId` uydurduğunda
 * arayüz `find(r => r.projectId === a.id)` ile eşleşme bulamıyor ve öneri
 * SESSİZCE kayboluyordu. Mentör "AI öner"e basıp hiçbir şey görmüyor,
 * nedenini de öğrenemiyordu.
 *
 * İkinci kusur: her arıza `throw` ile 500'e dönüyordu. Diğer AI
 * özelliklerinin hepsinde yedek varken burası tek istisnaydı.
 */

const { modelMock } = vi.hoisted(() => ({ modelMock: vi.fn() }));

vi.mock("@/lib/ai/gemini-client", () => ({
  getModel: () => ({ generateContent: modelMock }),
}));

import { recommendProjects, yedekSiralama } from "./project-recommendations";

const proje = (id: string, track: string[], difficulty: string): ProjectTemplate =>
  ({
    id,
    title: `Proje ${id}`,
    description: "açıklama",
    track,
    difficulty,
  }) as unknown as ProjectTemplate;

const adaylar = [
  proje("p1", ["Backend"], "MEDIUM"),
  proje("p2", ["Frontend"], "EASY"),
  proje("p3", ["DevOps"], "HARD"),
];

const ogrenci = {
  experienceLevel: "INTERMEDIATE",
  interests: ["Backend"],
  goals: "hedef",
  gitLevel: "basic",
  weeklyHours: 10,
  englishLevel: "reading",
} as unknown as StudentProfile;

const yanit = (metin: string) => ({
  response: { candidates: [{ content: { parts: [{ text: metin }] } }] },
});

beforeEach(() => vi.clearAllMocks());

describe("recommendProjects — uydurma id koruması", () => {
  it("aday kümesinde OLMAYAN id atılır", async () => {
    modelMock.mockResolvedValue(
      yanit(
        JSON.stringify([
          { projectId: "uydurma-id", matchScore: 99, reason: "x" },
          { projectId: "p1", matchScore: 80, reason: "y" },
        ]),
      ),
    );

    const sonuc = await recommendProjects(ogrenci, adaylar);

    expect(sonuc.map((r) => r.projectId)).toEqual(["p1"]);
  });

  it("dönen HER id aday kümesinden olur", async () => {
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "hayalet", matchScore: 90, reason: "x" }])),
    );

    const sonuc = await recommendProjects(ogrenci, adaylar);
    const gecerli = new Set(adaylar.map((p) => p.id));

    expect(sonuc.length).toBeGreaterThan(0);
    expect(sonuc.every((r) => gecerli.has(r.projectId))).toBe(true);
  });

  it("AYNI proje iki kez önerilirse bir kez döner", async () => {
    modelMock.mockResolvedValue(
      yanit(
        JSON.stringify([
          { projectId: "p1", matchScore: 90, reason: "x" },
          { projectId: "p1", matchScore: 70, reason: "y" },
        ]),
      ),
    );

    expect(await recommendProjects(ogrenci, adaylar)).toHaveLength(1);
  });
});

describe("recommendProjects — yedek", () => {
  it("model HATA fırlatırsa mentör boş kalmaz", async () => {
    modelMock.mockRejectedValue(new Error("kota doldu"));

    const sonuc = await recommendProjects(ogrenci, adaylar);

    expect(sonuc.length).toBeGreaterThan(0);
    expect(sonuc.every((r) => r.reason.length > 0)).toBe(true);
  });

  it("hiç GEÇERLİ id kalmazsa yedeğe düşülür", async () => {
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "yok1" }, { projectId: "yok2" }])),
    );

    expect((await recommendProjects(ogrenci, adaylar)).length).toBeGreaterThan(0);
  });

  it("BOZUK JSON çökmez", async () => {
    modelMock.mockResolvedValue(yanit("bu json değil"));

    await expect(recommendProjects(ogrenci, adaylar)).resolves.toBeTruthy();
  });

  it("aday YOKSA boş döner — yedek uydurmaz", async () => {
    expect(await recommendProjects(ogrenci, [])).toEqual([]);
    expect(modelMock).not.toHaveBeenCalled();
  });
});

describe("recommendProjects — puan doğrulaması", () => {
  it("100'den BÜYÜK puan sıkıştırılır", async () => {
    // Arayüz "%150 Uyum" basıyordu.
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "p1", matchScore: 150, reason: "x" }])),
    );

    expect((await recommendProjects(ogrenci, adaylar))[0].matchScore).toBe(100);
  });

  it("NEGATİF puan sıkıştırılır", async () => {
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "p1", matchScore: -20, reason: "x" }])),
    );

    expect((await recommendProjects(ogrenci, adaylar))[0].matchScore).toBe(0);
  });

  it("puan SAYI değilse makul bir değere düşer", async () => {
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "p1", matchScore: "çok iyi", reason: "x" }])),
    );

    const puan = (await recommendProjects(ogrenci, adaylar))[0].matchScore;
    expect(puan).toBeGreaterThanOrEqual(0);
    expect(puan).toBeLessThanOrEqual(100);
  });

  it("gerekçe BOŞ gelirse yerine bir şey konur", async () => {
    // Arayüz tırnak içinde boş bir kutu basardı.
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "p1", matchScore: 80, reason: "" }])),
    );

    expect((await recommendProjects(ogrenci, adaylar))[0].reason.length).toBeGreaterThan(0);
  });
});

describe("yedekSiralama — deterministik sıralama", () => {
  it("ilgi alanı örtüşen proje ÖNE gelir", () => {
    const sonuc = yedekSiralama(ogrenci, adaylar);
    expect(sonuc[0].projectId).toBe("p1");
  });

  it("gerekçede HAM değer değil etiket yazar", () => {
    const sonuc = yedekSiralama(
      { experienceLevel: "BEGINNER", interests: ["AI"] } as StudentProfile,
      [proje("pa", ["AI"], "EASY")],
    );

    expect(sonuc[0].reason).toContain("Yapay Zeka & ML");
  });

  it("en fazla 3 öneri döner", () => {
    const cok = Array.from({ length: 10 }, (_, i) => proje(`x${i}`, ["Backend"], "MEDIUM"));
    expect(yedekSiralama(ogrenci, cok)).toHaveLength(3);
  });

  it("hiç eşleşme olmasa da öneri üretir", () => {
    const alakasiz = [proje("z1", ["Embedded"], "HARD")];
    expect(yedekSiralama(ogrenci, alakasiz)).toHaveLength(1);
  });
});

/**
 * #499 — Proje yükü prompt'a giriyor mu.
 *
 * ⚠️ YANITTAN ANLAŞILMAZ: model ne döndürürse döndürsün, yükün prompt'a
 * girip girmediğini dışarıdan göremeyiz. Bu yüzden gönderilen METİN
 * doğrulanıyor — aksi halde alan sessizce düşse kimse fark etmezdi.
 */
describe("#499 — proje yükü prompt'a girer", () => {
  const yuklu = [
    { ...proje("p1", ["Backend"], "MEDIUM"), calisanSayisi: 0 },
    { ...proje("p2", ["Frontend"], "EASY"), calisanSayisi: 12 },
  ];

  it("calisanSayisi ve yogunluk bandı gönderilir", async () => {
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "p1", matchScore: 90, reason: "x" }])),
    );

    await recommendProjects(ogrenci, yuklu);

    const gonderilen = modelMock.mock.calls[0][0].contents[0].parts[0].text;
    expect(gonderilen).toContain("calisanSayisi");
    expect(gonderilen).toContain("yogunluk");
    // Boş proje "bos", 12 kişilik "yogun" bandına düşmeli.
    expect(gonderilen).toContain('"yogunluk": "bos"');
    expect(gonderilen).toContain('"yogunluk": "yogun"');
  });

  it("⚠️ kural YAZILI: yoğunluk İKİNCİL, uygunluk önce gelir", async () => {
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "p1", matchScore: 90, reason: "x" }])),
    );

    await recommendProjects(ogrenci, yuklu);

    const gonderilen = modelMock.mock.calls[0][0].contents[0].parts[0].text;
    // Sıralama kuralı olmadan model ham sayıyı kendi ölçeğinde yorumlardı.
    expect(gonderilen).toContain("İKİNCİL");
    expect(gonderilen).toMatch(/Uygunluk her zaman önce gelir/);
  });

  it("yük verilmezse 0 sayılır — eski çağıranlar kırılmaz", async () => {
    modelMock.mockResolvedValue(
      yanit(JSON.stringify([{ projectId: "p1", matchScore: 90, reason: "x" }])),
    );

    await recommendProjects(ogrenci, adaylar);

    const gonderilen = modelMock.mock.calls[0][0].contents[0].parts[0].text;
    expect(gonderilen).toContain('"calisanSayisi": 0');
  });
});
