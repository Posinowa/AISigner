import { describe, it, expect } from "vitest";
import { isAssignedMentor } from "./mentor-access";

// #195: Çoklu mentor (M:N) yetki mantığı — regresyona karşı kilit.
describe("isAssignedMentor (#195)", () => {
  it("öğrencinin mentorlarından biriyse → true (birden fazla mentor)", () => {
    const assignments = [{ mentorId: "A" }, { mentorId: "B" }];
    expect(isAssignedMentor(assignments, "A")).toBe(true);
    expect(isAssignedMentor(assignments, "B")).toBe(true);
  });

  it("öğrencinin mentoru DEĞİLSE → false (üçüncü bir mentor erişemez)", () => {
    const assignments = [{ mentorId: "A" }, { mentorId: "B" }];
    expect(isAssignedMentor(assignments, "C")).toBe(false);
  });

  it("hiç mentor atanmamışsa → false", () => {
    expect(isAssignedMentor([], "A")).toBe(false);
  });

  it("liste veya kullanıcı yoksa güvenli tarafta kal → false", () => {
    expect(isAssignedMentor(null, "A")).toBe(false);
    expect(isAssignedMentor(undefined, "A")).toBe(false);
    expect(isAssignedMentor([{ mentorId: "A" }], null)).toBe(false);
    expect(isAssignedMentor([{ mentorId: "A" }], undefined)).toBe(false);
  });
});
