import { describe, it, expect } from "vitest";
import { buildSurveyAnswerPayload } from "./answers";

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
