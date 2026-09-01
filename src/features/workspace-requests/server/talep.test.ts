// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * #349 — çalışma alanı talebi.
 *
 * Kilitlenen iki garanti:
 *   1. Mentör repo AÇAMAZ — yalnız talep eder. Onay yolu admin'den geçer.
 *   2. Kurulum başlatılamazsa talep "onaylandı" olarak ASILI KALMAZ; aksi
 *      halde "onaylandı ama ortada repo yok" hâli sessizce oluşurdu.
 */

const { prismaMock, kurulumMock } = vi.hoisted(() => ({
  prismaMock: {
    assignedProject: { findUnique: vi.fn() },
    workspaceRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
  kurulumMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/features/github/server/provisioning", async () => {
  const gercek = await vi.importActual<
    typeof import("@/features/github/server/provisioning")
  >("@/features/github/server/provisioning");
  return {
    // Hata SINIFI gerçek olmalı: `instanceof` kontrolü buna dayanıyor.
    KurulumZatenSuruyorError: gercek.KurulumZatenSuruyorError,
    baslatGitHubWorkspaceKurulumu: kurulumMock,
  };
});

import { KurulumZatenSuruyorError } from "@/features/github/server/provisioning";
import { talepOlustur, talebiKararaBagla } from "./talep";

const MENTOR = "mentor-1";

const atama = (ek: Record<string, unknown> = {}) => ({
  id: "ap1",
  githubStatus: "NOT_PROVISIONED",
  roadmap: { steps: [{ id: "s1" }] },
  studentProfile: { mentorAssignments: [{ mentorId: MENTOR }] },
  ...ek,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.assignedProject.findUnique.mockResolvedValue(atama());
  prismaMock.workspaceRequest.create.mockResolvedValue({ id: "wr1" });
  prismaMock.workspaceRequest.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.workspaceRequest.findUnique.mockResolvedValue({
    id: "wr1",
    assignedProjectId: "ap1",
  });
  prismaMock.workspaceRequest.update.mockResolvedValue({});
  kurulumMock.mockResolvedValue({ started: true });
});

describe("talepOlustur", () => {
  it("talebi açar ve bekleyen anahtarını atamaya bağlar", async () => {
    const s = await talepOlustur({ assignedProjectId: "ap1", mentorUserId: MENTOR });

    expect(s).toEqual({ ok: true, requestId: "wr1" });
    // `pendingKey` tekilliği veritabanında uyguluyor — atlanırsa iki eşzamanlı
    // istek iki bekleyen talep yaratır.
    expect(prismaMock.workspaceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pendingKey: "ap1" }),
      }),
    );
  });

  it("KURULUM YAPMAZ — repo açma yetkisi mentöre geçmiyor", async () => {
    await talepOlustur({ assignedProjectId: "ap1", mentorUserId: MENTOR });
    expect(kurulumMock).not.toHaveBeenCalled();
  });

  it("başka mentörün öğrencisine talep açamaz", async () => {
    const s = await talepOlustur({
      assignedProjectId: "ap1",
      mentorUserId: "baska-mentor",
    });

    expect(s).toEqual({ ok: false, neden: "yetki-yok" });
    expect(prismaMock.workspaceRequest.create).not.toHaveBeenCalled();
  });

  it("atama yoksa 'atama-yok'", async () => {
    prismaMock.assignedProject.findUnique.mockResolvedValue(null);
    expect(await talepOlustur({ assignedProjectId: "yok", mentorUserId: MENTOR })).toEqual({
      ok: false,
      neden: "atama-yok",
    });
  });

  it("yol haritası yoksa talep açılmaz — eksik ŞİMDİ söylenir", async () => {
    // Aksi halde admin onaylar, kurulum patlar, kimse nedenini bilmez.
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({ roadmap: { steps: [] } }),
    );

    expect(await talepOlustur({ assignedProjectId: "ap1", mentorUserId: MENTOR })).toEqual({
      ok: false,
      neden: "yol-haritasi-yok",
    });
  });

  it.each(["PROVISIONED", "PROVISIONING"])(
    "%s durumunda talep açılmaz",
    async (durum) => {
      prismaMock.assignedProject.findUnique.mockResolvedValue(
        atama({ githubStatus: durum }),
      );

      expect(await talepOlustur({ assignedProjectId: "ap1", mentorUserId: MENTOR })).toEqual({
        ok: false,
        neden: "zaten-kurulu",
      });
    },
  );

  it("ERROR durumunda YENİDEN talep edilebilir", async () => {
    // Bir kere patlayan atama kalıcı olarak kilitlenmemeli.
    prismaMock.assignedProject.findUnique.mockResolvedValue(
      atama({ githubStatus: "ERROR" }),
    );

    expect((await talepOlustur({ assignedProjectId: "ap1", mentorUserId: MENTOR })).ok).toBe(
      true,
    );
  });

  it("bekleyen talep varken ikincisi açılmaz (benzersizlik ihlali)", async () => {
    prismaMock.workspaceRequest.create.mockRejectedValue(
      new Error("Unique constraint failed on the fields: (`pendingKey`)"),
    );

    expect(await talepOlustur({ assignedProjectId: "ap1", mentorUserId: MENTOR })).toEqual({
      ok: false,
      neden: "zaten-bekliyor",
    });
  });
});

describe("talebiKararaBagla", () => {
  it("onayda kurulumu başlatır", async () => {
    const s = await talebiKararaBagla({ requestId: "wr1", adminUserId: "a1", onay: true });

    expect(s).toEqual({ ok: true, durum: "APPROVED", kurulumBaslatildi: true });
    // `guncelleme: false` — talep akışı yalnız İLK kurulum içindir.
    expect(kurulumMock).toHaveBeenCalledWith("ap1", false);
  });

  it("yalnızca PENDING talebi karara bağlar (atomik)", async () => {
    // İki admin aynı talebi onaylarsa kurulum iki kez tetiklenmemeli.
    await talebiKararaBagla({ requestId: "wr1", adminUserId: "a1", onay: true });

    expect(prismaMock.workspaceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wr1", status: "PENDING" },
      }),
    );
  });

  it("zaten karara bağlanmışsa kurulum BAŞLATILMAZ", async () => {
    prismaMock.workspaceRequest.updateMany.mockResolvedValue({ count: 0 });

    const s = await talebiKararaBagla({ requestId: "wr1", adminUserId: "a1", onay: true });

    expect(s).toEqual({ ok: false, neden: "zaten-karara-baglanmis" });
    expect(kurulumMock).not.toHaveBeenCalled();
  });

  it("talep hiç yoksa 'talep-yok'", async () => {
    prismaMock.workspaceRequest.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.workspaceRequest.findUnique.mockResolvedValue(null);

    expect(
      await talebiKararaBagla({ requestId: "yok", adminUserId: "a1", onay: true }),
    ).toEqual({ ok: false, neden: "talep-yok" });
  });

  it("gerekçesiz REDDEDİLEMEZ", async () => {
    // Mentör nedenini görmezse aynı talebi tekrar açar.
    const s = await talebiKararaBagla({ requestId: "wr1", adminUserId: "a1", onay: false });

    expect(s).toEqual({ ok: false, neden: "gerekce-gerekli" });
    expect(prismaMock.workspaceRequest.updateMany).not.toHaveBeenCalled();
  });

  it("gerekçeli red kaydedilir, kurulum başlatılmaz", async () => {
    const s = await talebiKararaBagla({
      requestId: "wr1",
      adminUserId: "a1",
      onay: false,
      adminNote: "Yol haritası netleşmemiş.",
    });

    expect(s).toEqual({ ok: true, durum: "REJECTED", kurulumBaslatildi: false });
    expect(kurulumMock).not.toHaveBeenCalled();
  });

  it("kararda bekleyen anahtarını serbest bırakır", async () => {
    // Aksi halde karara bağlanmış talep yeni talebi kalıcı olarak engellerdi.
    await talebiKararaBagla({ requestId: "wr1", adminUserId: "a1", onay: true });

    expect(prismaMock.workspaceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pendingKey: null }) }),
    );
  });

  it("KURULUM BAŞLATILAMAZSA kararı geri alır — talep PENDING'e döner", async () => {
    // Bu testin varlık sebebi: talep "onaylandı" kalırsa ortada repo olmaz ve
    // kuyruktan da düştüğü için kimse fark etmez.
    kurulumMock.mockRejectedValue(new Error("GITHUB_TOKEN tanımlı değil"));

    const s = await talebiKararaBagla({ requestId: "wr1", adminUserId: "a1", onay: true });

    expect(s.ok).toBe(false);
    expect(prismaMock.workspaceRequest.update).toHaveBeenCalledWith({
      where: { id: "wr1" },
      data: expect.objectContaining({ status: "PENDING", pendingKey: "ap1" }),
    });
  });

  it("kurulum zaten sürüyorsa nedeni admin'e taşınır", async () => {
    kurulumMock.mockRejectedValue(new KurulumZatenSuruyorError("Kurulum zaten sürüyor."));

    const s = await talebiKararaBagla({ requestId: "wr1", adminUserId: "a1", onay: true });

    expect(s).toMatchObject({ ok: false, neden: "kurulum-suruyor" });
    expect(prismaMock.workspaceRequest.update).toHaveBeenCalled();
  });
});
