import { describe, it, expect } from "vitest";
import { authorDisplayName, statusLabels, typeLabels } from "./labels";

describe("suggestions labels (#147)", () => {
  it("ad ve soyadı birleştirir", () => {
    expect(
      authorDisplayName({ name: "Ayşe", lastName: "Yılmaz", email: "a@x.com" }),
    ).toBe("Ayşe Yılmaz");
  });

  it("yalnızca ad varsa soyadsız döner", () => {
    expect(authorDisplayName({ name: "Ayşe", lastName: null, email: "a@x.com" })).toBe(
      "Ayşe",
    );
  });

  it("ad/soyad yoksa e-postaya düşer", () => {
    expect(authorDisplayName({ name: null, lastName: null, email: "a@x.com" })).toBe(
      "a@x.com",
    );
  });

  it("boşluktan ibaret ad e-postaya düşer", () => {
    expect(authorDisplayName({ name: "  ", lastName: null, email: "a@x.com" })).toBe(
      "a@x.com",
    );
  });

  it("tüm tip ve durumların Türkçe etiketi vardır", () => {
    expect(Object.values(typeLabels).every(Boolean)).toBe(true);
    expect(Object.values(statusLabels).every(Boolean)).toBe(true);
  });
});
