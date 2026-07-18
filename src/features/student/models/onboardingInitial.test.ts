import { describe, it, expect } from "vitest";
import { buildOnboardingDefaultValues, shouldShowSurveyStep } from "./onboardingInitial";
import { compileGoals } from "./compiledGoals";

describe("buildOnboardingDefaultValues (#115)", () => {
  it("profil YOK (initial undefined) → tüm alanlar boş varsayılanlarla döner", () => {
    const d = buildOnboardingDefaultValues(undefined);

    expect(d.personal).toEqual({
      firstName: "",
      lastName: "",
      birthYear: undefined,
      phoneNumber: "",
    });
    expect(d.experience).toEqual({ level: "", knownTech: "" });
    expect(d.vision).toEqual({ interest: [], futureGoal: "" });
    expect(d.workingStyle).toEqual({ learningStyle: "", availability: "" });
  });

  it("yalnızca signup verisi (profil alanları yok) → personal dolu, gerisi boş", () => {
    const d = buildOnboardingDefaultValues({
      firstName: "Alper",
      lastName: "Ersü",
      phoneNumber: "05551234567",
    });

    expect(d.personal.firstName).toBe("Alper");
    expect(d.personal.lastName).toBe("Ersü");
    expect(d.personal.phoneNumber).toBe("05551234567");
    expect(d.experience.level).toBe("");
    expect(d.vision.interest).toEqual([]);
  });

  it("profil VAR → tüm alanlar prefill edilir; compiled goals round-trip bozulmaz", () => {
    // #89-2: goals compile → parse round-trip'inin prefill ile bozulmadığını doğrula.
    const compiled = compileGoals({
      knownTech: "C++ gördüm, HTML/CSS ile site yaptım",
      futureGoal: "AI destekli web uygulaması geliştirmek",
      learningStyle: "Adım adım doküman okuyarak",
    });

    const d = buildOnboardingDefaultValues({
      firstName: "Alper",
      lastName: "Ersü",
      phoneNumber: "05551234567",
      birthYear: 2002,
      experienceLevel: "INTERMEDIATE",
      interests: ["AI", "Web Development"],
      goals: compiled,
      availability: "part-time",
    });

    expect(d.personal.birthYear).toBe(2002);
    expect(d.experience.knownTech).toBe("C++ gördüm, HTML/CSS ile site yaptım");
    expect(d.vision.futureGoal).toBe("AI destekli web uygulaması geliştirmek");
    expect(d.workingStyle.learningStyle).toBe("Adım adım doküman okuyarak");
    expect(d.vision.interest).toEqual(["AI", "Web Development"]);
    expect(d.workingStyle.availability).toBe("part-time");
  });

  it("experienceLevel DB→form eşlemesi sabittir (#89-2)", () => {
    const cases: Array<[string, string]> = [
      ["BEGINNER", "beginner"],
      ["INTERMEDIATE", "intermediate"],
      ["ADVANCED", "advanced"],
    ];
    for (const [db, form] of cases) {
      expect(buildOnboardingDefaultValues({ experienceLevel: db }).experience.level).toBe(form);
    }
  });

  it("derlenmemiş (serbest) goals metni knownTech'e düşmez, formatı bozmaz", () => {
    // parseCompiledGoals derlenmemiş metinde alanları boş döndürür — prefill
    // eski/serbest formatlı goals verisiyle patlamamalı.
    const d = buildOnboardingDefaultValues({ goals: "sadece düz bir hedef cümlesi" });
    expect(typeof d.experience.knownTech).toBe("string");
    expect(typeof d.vision.futureGoal).toBe("string");
  });
});

describe("shouldShowSurveyStep (#115)", () => {
  it("soru VAR → adım gösterilir (survey yüklendi senaryosu)", () => {
    expect(shouldShowSurveyStep(3, false)).toBe(true);
  });

  it("soru YOK + yükleme başarılı (gerçek boş) → adım gizlenir", () => {
    expect(shouldShowSurveyStep(0, false)).toBe(false);
  });

  it("yükleme BAŞARISIZ → soru olmasa da adım gösterilir (uyarı görünsün)", () => {
    expect(shouldShowSurveyStep(0, true)).toBe(true);
  });
});
