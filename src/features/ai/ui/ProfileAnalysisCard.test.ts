import { describe, it, expect } from "vitest";
import {
  resolveProfileAnalysisViewState,
  parseProfileAnalysisApiResponse,
  type ProfileAnalysisData,
} from "./ProfileAnalysisCard";

const sampleAnalysis: ProfileAnalysisData = {
  level: "Orta",
  summary: "özet",
  strengths: [],
  developmentAreas: [],
  technicalTracks: [],
  recommendedPath: "",
  recommendations: [],
};

describe("resolveProfileAnalysisViewState (#83)", () => {
  it("loading=true iken her zaman 'loading' döner (error/analysis olsa bile)", () => {
    expect(resolveProfileAnalysisViewState({ analysis: null, loading: true, error: null })).toBe(
      "loading",
    );
    expect(
      resolveProfileAnalysisViewState({ analysis: sampleAnalysis, loading: true, error: "hata" }),
    ).toBe("loading");
  });

  it("loading=false + error varsa 'error' döner (analysis olsa bile)", () => {
    expect(
      resolveProfileAnalysisViewState({ analysis: null, loading: false, error: "Bağlantı hatası" }),
    ).toBe("error");
    expect(
      resolveProfileAnalysisViewState({
        analysis: sampleAnalysis,
        loading: false,
        error: "Bağlantı hatası",
      }),
    ).toBe("error");
  });

  it("hata yok + analiz yok (null/undefined) → 'empty' — 'fetch başarısız' ile karışmaz", () => {
    expect(resolveProfileAnalysisViewState({ analysis: null, loading: false, error: null })).toBe(
      "empty",
    );
    expect(
      resolveProfileAnalysisViewState({ analysis: undefined, loading: false, error: undefined }),
    ).toBe("empty");
  });

  it("hata yok + analiz var → 'data'", () => {
    expect(
      resolveProfileAnalysisViewState({ analysis: sampleAnalysis, loading: false, error: null }),
    ).toBe("data");
  });

  it("loading/error belirtilmezse (undefined) analiz varlığına göre karar verir", () => {
    expect(resolveProfileAnalysisViewState({ analysis: sampleAnalysis })).toBe("data");
    expect(resolveProfileAnalysisViewState({ analysis: null })).toBe("empty");
  });
});

describe("parseProfileAnalysisApiResponse (#83)", () => {
  it("ok + analysis:null → analiz yok (empty) — HATA DEĞİL", () => {
    const result = parseProfileAnalysisApiResponse(true, { analysis: null });
    expect(result).toEqual({ analysis: null, error: null });
  });

  it("ok + analysis:{...} → analiz döner, error null", () => {
    const result = parseProfileAnalysisApiResponse(true, { analysis: sampleAnalysis });
    expect(result).toEqual({ analysis: sampleAnalysis, error: null });
  });

  it("!ok + string error (404/400 mesajı) → error döner, analysis null", () => {
    const result = parseProfileAnalysisApiResponse(false, { error: "Öğrenci profili bulunamadı." });
    expect(result).toEqual({ analysis: null, error: "Öğrenci profili bulunamadı." });
  });

  it("!ok + body yok/boş → fallback mesaj", () => {
    expect(parseProfileAnalysisApiResponse(false, null)).toEqual({
      analysis: null,
      error: "Analiz yüklenemedi.",
    });
    expect(parseProfileAnalysisApiResponse(false, {})).toEqual({
      analysis: null,
      error: "Analiz yüklenemedi.",
    });
  });

  it("ok=true ama body null (beklenmeyen şekil) → yine de empty sayılır, error atılmaz", () => {
    // Sunucu her zaman {analysis: ...} döner ama savunma amaçlı: ok=true iken
    // asla error state'ine düşülmemeli.
    expect(parseProfileAnalysisApiResponse(true, null)).toEqual({ analysis: null, error: null });
  });
});
