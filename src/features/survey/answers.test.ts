import { describe, it, expect } from "vitest";
import { buildSurveyAnswerPayload, extractSurveyErrorMessage } from "./answers";

describe("buildSurveyAnswerPayload (#46)", () => {
  it("dolu cevapları {questionId, answer} dizisine çevirir", () => {
    const result = buildSurveyAnswerPayload({ q1: "JavaScript", q2: "Backend" });
    expect(result).toEqual([
      { questionId: "q1", answer: "JavaScript" },
      { questionId: "q2", answer: "Backend" },
    ]);
  });

  it("boş / whitespace cevapları eler (anket opsiyonel)", () => {
    const result = buildSurveyAnswerPayload({ q1: "  ", q2: "", q3: "Python" });
    expect(result).toEqual([{ questionId: "q3", answer: "Python" }]);
  });

  it("cevapları trim'ler", () => {
    expect(buildSurveyAnswerPayload({ q1: "  Go  " })).toEqual([
      { questionId: "q1", answer: "Go" },
    ]);
  });

  it("hiç dolu cevap yoksa boş dizi döner", () => {
    expect(buildSurveyAnswerPayload({ q1: "", q2: "   " })).toEqual([]);
    expect(buildSurveyAnswerPayload({})).toEqual([]);
  });
});

describe("extractSurveyErrorMessage (#83)", () => {
  it("düz string hatayı olduğu gibi döner (SurveyValidationError/500)", () => {
    expect(extractSurveyErrorMessage("Öğrenci profili bulunamadı.", "fallback")).toBe(
      "Öğrenci profili bulunamadı.",
    );
  });

  it("zod fieldErrors objesindeki ilk mesajı çıkarır (400 validation) — önceki bug", () => {
    // Önceki kod yalnızca string kontrolü yapıyordu; obje gelince bu mesaj
    // kayboluyor ve kullanıcı genel/anlamsız bir hata görüyordu.
    expect(extractSurveyErrorMessage({ answers: ["En az bir cevap gerekli"] }, "fallback")).toBe(
      "En az bir cevap gerekli",
    );
  });

  it("birden fazla alan hatası varsa ilkini döner", () => {
    expect(
      extractSurveyErrorMessage(
        { answers: ["Hata 1"], other: ["Hata 2"] },
        "fallback",
      ),
    ).toBe("Hata 1");
  });

  it("tanınmayan şekil (null/undefined/boş obje) → fallback", () => {
    expect(extractSurveyErrorMessage(null, "fallback")).toBe("fallback");
    expect(extractSurveyErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(extractSurveyErrorMessage({}, "fallback")).toBe("fallback");
    expect(extractSurveyErrorMessage("", "fallback")).toBe("fallback");
  });
});
