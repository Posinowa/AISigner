import { describe, it, expect } from "vitest";
import { sablonuYonetebilir, sablonOlusturabilir } from "./yetki";

/**
 * #253 — sahiplik kuralı. Mentör kendi şablonunu yönetebilir, başkasınınkine
 * dokunamaz; sahipsiz (eski) şablonlar yalnızca admin'e açıktır.
 */

const admin = { id: "a1", role: "ADMIN" };
const mentor = { id: "m1", role: "MENTOR" };
const digerMentor = { id: "m2", role: "MENTOR" };
const ogrenci = { id: "s1", role: "STUDENT" };

describe("sablonuYonetebilir — admin", () => {
  it.each([
    ["kendi şablonu", "a1"],
    ["mentörün şablonu", "m1"],
    ["sahipsiz şablon", null],
  ])("admin %s üzerinde yetkilidir", (_ad, createdById) => {
    expect(sablonuYonetebilir(admin, { createdById })).toBe(true);
  });
});

describe("sablonuYonetebilir — mentör", () => {
  it("kendi şablonunu yönetebilir", () => {
    expect(sablonuYonetebilir(mentor, { createdById: "m1" })).toBe(true);
  });

  it("BAŞKA mentörün şablonuna dokunamaz", () => {
    expect(sablonuYonetebilir(digerMentor, { createdById: "m1" })).toBe(false);
  });

  it("sahipsiz (eski) şablona dokunamaz", () => {
    // Aksi halde herhangi bir mentör tüm eski şablonları silebilirdi.
    expect(sablonuYonetebilir(mentor, { createdById: null })).toBe(false);
  });
});

describe("sablonuYonetebilir — diğer roller", () => {
  it("öğrenci hiçbir şablonu yönetemez", () => {
    expect(sablonuYonetebilir(ogrenci, { createdById: "s1" })).toBe(false);
  });

  it.each([null, undefined, "", "GUEST"])(
    "tanınmayan rol (%s) yetkisizdir",
    (role) => {
      expect(sablonuYonetebilir({ id: "x", role }, { createdById: "x" })).toBe(
        false,
      );
    },
  );
});

describe("sablonOlusturabilir", () => {
  it.each([admin, mentor])("$role oluşturabilir", (k) => {
    expect(sablonOlusturabilir(k)).toBe(true);
  });

  it.each([ogrenci, { id: "x", role: null }])("yetkisiz rol oluşturamaz", (k) => {
    expect(sablonOlusturabilir(k)).toBe(false);
  });
});

describe("sablonuYonetebilir — kimliksiz oturum (#253)", () => {
  it.each([null, undefined, ""])(
    "id yoksa (%s) mentör sahiplik iddia edemez",
    (id) => {
      // Oturum tipinde id opsiyonel; boş kimlik eşleşmeye dönüşmemeli.
      expect(sablonuYonetebilir({ id, role: "MENTOR" }, { createdById: null })).toBe(false);
      expect(
        sablonuYonetebilir({ id, role: "MENTOR" }, { createdById: "m1" }),
      ).toBe(false);
    },
  );
});
