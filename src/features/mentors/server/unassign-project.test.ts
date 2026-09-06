import { describe, it, expect, beforeEach, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { assignedProject: { findFirst: vi.fn(), delete: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { unassignProject } from "./actions";

/** Bu mentöre ait, verilen ilerleme durumuyla proje. */
function ownedProject(over: {
  status?: string;
  roadmapStatus?: string | null;
  stepStatuses?: string[];
} = {}) {
  return {
    id: "ap-1",
    status: over.status ?? "PENDING",
    roadmap:
      over.roadmapStatus === null
        ? null
        : {
            status: over.roadmapStatus ?? "DRAFT",
            steps: (over.stepStatuses ?? []).map((s) => ({ status: s })),
          },
  };
}

describe("unassignProject action — sahiplik + force (#184)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.assignedProject.delete.mockResolvedValue({});
  });

  it("IDOR: başka mentörün projesi (bulunamaz) → hata, silme YOK", async () => {
    // findFirst where: { studentProfile: { mentorId } } — başka mentör için null döner
    prismaMock.assignedProject.findFirst.mockResolvedValue(null);

    await expect(unassignProject("ap-1", "mentor-1", false)).rejects.toThrow(/yetkiniz yok|bulunamadı/i);
    expect(prismaMock.assignedProject.delete).not.toHaveBeenCalled();
  });

  it("sahiplik sorgusu mentorId ile sınırlıdır", async () => {
    prismaMock.assignedProject.findFirst.mockResolvedValue(ownedProject());

    await unassignProject("ap-1", "mentor-1", false);

    const where = prismaMock.assignedProject.findFirst.mock.calls[0][0].where;
    // #370: Sahiplik bireysel VEYA takım bağından gelir.
    expect(where.id).toBe("ap-1");
    expect(where.studentProfile.OR[0].mentorAssignments.some.mentorId).toBe("mentor-1");
    expect(where.studentProfile.OR[1].teamMemberships.some.team.mentors.some.mentorId).toBe(
      "mentor-1",
    );
    expect(where.studentProfile.OR[1].teamMemberships.some.leftAt).toBeNull();
  });

  it("ilerleme yoksa (PENDING, DRAFT) force'suz → siler", async () => {
    prismaMock.assignedProject.findFirst.mockResolvedValue(ownedProject());

    await unassignProject("ap-1", "mentor-1", false);

    expect(prismaMock.assignedProject.delete).toHaveBeenCalledWith({ where: { id: "ap-1" } });
  });

  it("proje IN_PROGRESS + force'suz → REQUIRES_CONFIRMATION, silme YOK", async () => {
    prismaMock.assignedProject.findFirst.mockResolvedValue(ownedProject({ status: "IN_PROGRESS" }));

    await expect(unassignProject("ap-1", "mentor-1", false)).rejects.toMatchObject({
      code: "REQUIRES_CONFIRMATION",
    });
    expect(prismaMock.assignedProject.delete).not.toHaveBeenCalled();
  });

  it("yayınlanmış roadmap + force'suz → REQUIRES_CONFIRMATION", async () => {
    prismaMock.assignedProject.findFirst.mockResolvedValue(
      ownedProject({ roadmapStatus: "PUBLISHED" }),
    );

    await expect(unassignProject("ap-1", "mentor-1", false)).rejects.toMatchObject({
      code: "REQUIRES_CONFIRMATION",
    });
  });

  it("adım ilerlemesi (COMPLETED) + force'suz → REQUIRES_CONFIRMATION", async () => {
    prismaMock.assignedProject.findFirst.mockResolvedValue(
      ownedProject({ stepStatuses: ["TODO", "COMPLETED"] }),
    );

    await expect(unassignProject("ap-1", "mentor-1", false)).rejects.toMatchObject({
      code: "REQUIRES_CONFIRMATION",
    });
  });

  it("ilerleme olsa bile force=true → siler", async () => {
    prismaMock.assignedProject.findFirst.mockResolvedValue(ownedProject({ status: "IN_PROGRESS" }));

    await unassignProject("ap-1", "mentor-1", true);

    expect(prismaMock.assignedProject.delete).toHaveBeenCalledWith({ where: { id: "ap-1" } });
  });
});
