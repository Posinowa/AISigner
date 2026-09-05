import { describe, it, expect, beforeEach, vi } from "vitest";

const { requireAuthMock, prismaMock, recommendMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  prismaMock: {
    studentProfile: { findFirst: vi.fn() },
    // #498: Atanmış projeler artık `sahiplik.ts` üzerinden AYRI sorguyla
    // geliyor — profilin içinden değil.
    assignedProject: { findMany: vi.fn() },
    // #499: Şablon yükü ham SQL ile toplanıyor (kimse çalışmıyorsa boş dizi).
    $queryRaw: vi.fn(),
    mentorProfile: { findUnique: vi.fn() },
    projectTemplate: { findMany: vi.fn() },
  },
  recommendMock: vi.fn(),
}));
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: (...a: unknown[]) => requireAuthMock(...a),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/features/ai/server/project-recommendations", () => ({
  recommendProjects: (...a: unknown[]) => recommendMock(...a),
}));
// Rate limiter: testte hep izin ver.
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: () => ({ allowed: true }) }),
}));
// #321: KVKK rizasi — varsayilan olarak VAR; ayri bir test yoklugunu olcuyor.
vi.mock("@/features/kvkk/riza", () => ({
  profilSahibininRizasiVar: () => Promise.resolve(true),
}));

import { POST } from "./route";

function mentor(id = "mentor-1") {
  requireAuthMock.mockResolvedValue({ authorized: true, session: { user: { id, role: "MENTOR" } } });
}
function req(body: unknown) {
  return new Request("http://t", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ai-recommend-projects (#189)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([]);
    recommendMock.mockResolvedValue([]);
    // Sistemde değerlendirilecek şablon var (boşsa route 404 döner).
    prismaMock.projectTemplate.findMany.mockResolvedValue([{ id: "t1" }]);
    prismaMock.mentorProfile.findUnique.mockResolvedValue(null);
  });

  it("MENTOR değil → 403", async () => {
    requireAuthMock.mockResolvedValue({ authorized: false, response: new Response(null, { status: 403 }) });
    const res = await POST(req({ studentProfileId: "sp-1" }));
    expect(res.status).toBe(403);
    expect(prismaMock.studentProfile.findFirst).not.toHaveBeenCalled();
  });

  it("geçersiz gövde → 400", async () => {
    mentor();
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("sahiplik: başka mentörün öğrencisi (findFirst null) → 404, AI çağrılmaz", async () => {
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue(null);
    const res = await POST(req({ studentProfileId: "sp-1" }));
    expect(res.status).toBe(404);
    expect(recommendMock).not.toHaveBeenCalled();
    // sorgu mentorId ile sınırlı
    expect(prismaMock.studentProfile.findFirst).toHaveBeenCalledWith(
      // #370: bireysel VEYA takım bağı.
      expect.objectContaining({
        where: {
          id: "sp-1",
      OR: [
        { mentorAssignments: { some: { mentorId: "mentor-1" } } },
        {
          teamMemberships: {
            some: { leftAt: null, team: { mentors: { some: { mentorId: "mentor-1" } } } },
          },
        },
      ],
        },
      }),
    );
  });

  it("kendi öğrencisi → 200, öneri döner", async () => {
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue({
      id: "sp-1",
      mentorId: "mentor-1",
    });
    prismaMock.assignedProject.findMany.mockResolvedValue([]);
    const res = await POST(req({ studentProfileId: "sp-1" }));
    expect(res.status).toBe(200);
    expect(recommendMock).toHaveBeenCalled();
  });

  it("#295: ATANMIŞ projeler aday kümesinden çıkarılır", async () => {
    // Eskiden AI bunlara da slot harcıyordu; arayüz onları gizlediği için
    // mentör 3 yerine 1-2 kullanılabilir öneri görüyordu.
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue({ id: "sp-1" });
    prismaMock.assignedProject.findMany.mockResolvedValue([
      { projectTemplateId: "t9", projectTemplate: { tekrarlanabilir: false } },
    ]);

    await POST(req({ studentProfileId: "sp-1" }));

    expect(prismaMock.projectTemplate.findMany).toHaveBeenCalledWith(
      // #366: stajyerin kendi önerisinden türeyen şablon ORTAK HAVUZA girmez;
      // başkasına önerilirse öneren kişinin fikri habersiz dağıtılmış olurdu.
      expect.objectContaining({
        where: { id: { notIn: ["t9"] }, fromProposal: false },
      }),
    );
  });

  /**
   * #498 — TAKIM PROJESİ DE ELENİR.
   *
   * ⚠️ BU TESTİN OLMAMASI HATAYI YAŞATTI. Rota atanmış projeleri
   * `studentProfile.assignedProjects` üzerinden okuyordu ve takım atamasında
   * `studentProfileId` NULL olduğu için (#332) takımın projesi süzgece HİÇ
   * girmiyordu. Canlıda AI, öğrencinin takımıyla çalıştığı projeyi listenin
   * BAŞINDA %95 eşleşmeyle önerdi.
   */
  it("⚠️ #498: atanmış projeler `sahiplik.ts`'ten sorulur — takım ataması da elenir", async () => {
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue({ id: "sp-1" });
    prismaMock.assignedProject.findMany.mockResolvedValue([
      { projectTemplateId: "takim-projesi", projectTemplate: { tekrarlanabilir: false } },
    ]);

    await POST(req({ studentProfileId: "sp-1" }));

    // Sorgu profilin içinden değil, sahiplik koşuluyla AYRI çalışmalı.
    const kosul = JSON.stringify(prismaMock.assignedProject.findMany.mock.calls[0][0].where);
    expect(kosul).toContain("studentProfileId");
    expect(kosul).toContain("team");

    expect(prismaMock.projectTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { notIn: ["takim-projesi"] }, fromProposal: false },
      }),
    );
  });

  /**
   * #503 — TEKRARLANABİLİR ŞABLON ELEMEDEN MUAF.
   *
   * ⚠️ Portfolyo sitesi gibi herkesin yapması beklenen bir iş, zaten atanmış
   * olsa da yeniden önerilebilmeli. Aksi halde bayrak YARI çalışırdı: mentör
   * elle atayabilir ama AI hiç önermezdi.
   */
  it("⚠️ #503: tekrarlanabilir şablon atanmış olsa da aday kümesinde KALIR", async () => {
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue({ id: "sp-1" });
    prismaMock.assignedProject.findMany.mockResolvedValue([
      { projectTemplateId: "portfolyo", projectTemplate: { tekrarlanabilir: true } },
      { projectTemplateId: "normal", projectTemplate: { tekrarlanabilir: false } },
    ]);

    await POST(req({ studentProfileId: "sp-1" }));

    expect(prismaMock.projectTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Yalnız tekrarlanamaz olan eleniyor.
        where: { id: { notIn: ["normal"] }, fromProposal: false },
      }),
    );
  });

  it("#295: mentörün UZMANLIĞI öneriye geçirilir", async () => {
    // Mentör süpervize edemeyeceği projeye yol haritası çizemez.
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockResolvedValue({ id: "sp-1" });
    prismaMock.assignedProject.findMany.mockResolvedValue([]);
    prismaMock.mentorProfile.findUnique.mockResolvedValue({
      expertise: ["Backend"],
      seniority: "senior",
    });

    await POST(req({ studentProfileId: "sp-1" }));

    expect(recommendMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expertise: ["Backend"] }),
    );
  });

  it("#295: HAM hata metni istemciye dönmez", async () => {
    // Eskiden `rootCause` doğrudan gövdeye yazılıyordu; iç hata metni
    // (prompt parçaları dahil olabilir) istemciye sızıyordu.
    mentor("mentor-1");
    prismaMock.studentProfile.findFirst.mockRejectedValue(new Error("SIZAN_IC_DETAY"));

    const res = await POST(req({ studentProfileId: "sp-1" }));
    const govde = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(govde)).not.toContain("SIZAN_IC_DETAY");
  });
});
