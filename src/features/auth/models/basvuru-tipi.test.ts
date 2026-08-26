import { describe, it, expect } from "vitest";
import { basvuruTipiCoz, basvuruRolu } from "./basvuru-tipi";

/**
 * #250 — rol istemciden geliyor; bu testler ayrıcalık yükseltmeyi kilitliyor.
 */

describe("basvuruTipiCoz — mentör tanınır", () => {
  it.each(["mentor", "mentör", "MENTOR", "Mentör", "  mentor  "])(
    "%s → mentor",
    (girdi) => expect(basvuruTipiCoz(girdi)).toBe("mentor"),
  );
});

describe("basvuruTipiCoz — tanınmayan her şey stajyer olur", () => {
  it.each([
    "stajyer",
    "student",
    "",
    "   ",
    "mentorluk",
    "men tor",
    "MENTOR;--",
  ])("%s → stajyer", (girdi) => {
    expect(basvuruTipiCoz(girdi)).toBe("stajyer");
  });

  it.each([undefined, null, 0, {}, [], true])(
    "string olmayan girdi (%s) stajyer olur",
    (girdi) => expect(basvuruTipiCoz(girdi)).toBe("stajyer"),
  );
});

describe("basvuruRolu — ADMIN asla üretilmez", () => {
  it("mentor → MENTOR", () => expect(basvuruRolu("mentor")).toBe("MENTOR"));
  it("stajyer → STUDENT", () => expect(basvuruRolu("stajyer")).toBe("STUDENT"));

  it.each(["admin", "ADMIN", "Admin", "administrator"])(
    "%s girdisi hiçbir şekilde ADMIN'e çıkmaz",
    (girdi) => {
      // En kritik senaryo: kayıt formundan admin hesabı üretmek.
      const rol = basvuruRolu(basvuruTipiCoz(girdi));
      expect(rol).toBe("STUDENT");
    },
  );

  it("hiçbir girdi kombinasyonu ADMIN döndürmez", () => {
    const girdiler = ["mentor", "stajyer", "admin", "ADMIN", "", "x", "mentör"];
    const roller = new Set(girdiler.map((g) => basvuruRolu(basvuruTipiCoz(g))));
    expect([...roller].sort()).toEqual(["MENTOR", "STUDENT"]);
  });
});
