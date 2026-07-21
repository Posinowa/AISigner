import { describe, it, expect, beforeEach, vi } from "vitest";

// #143: Onay kapısının profil tamamlamadan SONRA devreye girmesi kritik bir
// erişim kuralı — PENDING profilini doldurabilmeli, REJECTED asla.
const { getServerSessionMock } = vi.hoisted(() => ({ getServerSessionMock: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: () => getServerSessionMock() }));
vi.mock("@/lib/auth/nextauth", () => ({ authOptions: {} }));

import { requireAuth } from "./guard";

function session(role: string, accountStatus?: string) {
  getServerSessionMock.mockResolvedValue({
    user: { id: "u1", role, accountStatus },
  });
}

describe("requireAuth — hesap onay kapısı (#143)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("APPROVED stajyer normal uçlara erişir", async () => {
    session("STUDENT", "APPROVED");
    const res = await requireAuth("STUDENT");
    expect(res.authorized).toBe(true);
  });

  it("PENDING stajyer normal uçlarda 403 alır (varsayılan)", async () => {
    session("STUDENT", "PENDING");
    const res = await requireAuth("STUDENT");
    expect(res.authorized).toBe(false);
    if (!res.authorized) expect(res.response.status).toBe(403);
  });

  it("PENDING stajyer profil tamamlama ucuna (opt-in) erişebilir", async () => {
    session("STUDENT", "PENDING");
    const res = await requireAuth("STUDENT", { allowUnapprovedStudent: true });
    expect(res.authorized).toBe(true);
  });

  it("REJECTED stajyer opt-in olsa DA erişemez", async () => {
    session("STUDENT", "REJECTED");
    const res = await requireAuth("STUDENT", { allowUnapprovedStudent: true });
    expect(res.authorized).toBe(false);
    if (!res.authorized) expect(res.response.status).toBe(403);
  });

  it("opt-in yalnızca STUDENT onay kuralını etkiler; rol kontrolü aynen sürer", async () => {
    session("STUDENT", "PENDING");
    const res = await requireAuth("ADMIN", { allowUnapprovedStudent: true });
    expect(res.authorized).toBe(false);
    if (!res.authorized) expect(res.response.status).toBe(403);
  });

  it("oturum yoksa 401 döner", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const res = await requireAuth("STUDENT", { allowUnapprovedStudent: true });
    expect(res.authorized).toBe(false);
    if (!res.authorized) expect(res.response.status).toBe(401);
  });

  it("ADMIN/MENTOR onay kuralından etkilenmez", async () => {
    session("ADMIN", undefined);
    expect((await requireAuth("ADMIN")).authorized).toBe(true);
    session("MENTOR", undefined);
    expect((await requireAuth("MENTOR")).authorized).toBe(true);
  });
});
