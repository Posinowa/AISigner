"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";

type Props = {
  onComplete?: () => void;
};

export function SecurityQuestionsSetup({ onComplete }: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/security-questions");
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setIsSetup(data.isSetup);
        if (data.isSetup && data.answeredQuestionIds) {
          setSelectedQuestions(data.answeredQuestionIds);
        }
      }
    } catch {
      setError("Güvenlik soruları yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  function toggleQuestion(qId: number) {
    setSelectedQuestions((prev) => {
      if (prev.includes(qId)) {
        const newAnswers = { ...answers };
        delete newAnswers[qId];
        setAnswers(newAnswers);
        return prev.filter((id) => id !== qId);
      }
      if (prev.length >= 3) return prev; // Max 3
      return [...prev, qId];
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (selectedQuestions.length < 3) {
      setError("En az 3 soru seçmelisiniz.");
      return;
    }

    for (const qId of selectedQuestions) {
      if (!answers[qId] || answers[qId].trim().length < 2) {
        setError("Her cevap en az 2 karakter olmalıdır.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/security-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: selectedQuestions.map((qId) => ({
            questionId: qId,
            answer: answers[qId],
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Kaydedilemedi.");
        return;
      }

      setSuccess(true);
      setIsSetup(true);
      if (onComplete) onComplete();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        <span className="ml-2 text-gray-600 dark:text-slate-300">Yükleniyor...</span>
      </div>
    );
  }

  if (success || (isSetup && !Object.keys(answers).length)) {
    return (
      <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 rounded-xl p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
        <h3 className="font-semibold text-green-800 dark:text-green-300">Güvenlik Soruları Ayarlandı</h3>
        <p className="text-sm text-green-600 mt-1">
          Şifrenizi unutursanız bu sorularla sıfırlayabilirsiniz.
        </p>
        <button
          onClick={() => {
            setIsSetup(false);
            setSuccess(false);
            setSelectedQuestions([]);
            setAnswers({});
          }}
          className="mt-3 text-sm text-green-700 dark:text-green-300 hover:text-green-900 underline"
        >
          Soruları Güncelle
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-amber-500" />
        <h3 className="font-semibold text-gray-900 dark:text-slate-100">Güvenlik Soruları</h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
        Şifrenizi unutmanız durumunda sıfırlayabilmeniz için 3 güvenlik sorusu seçin ve cevaplayın.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Soru Seçimi */}
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const isSelected = selectedQuestions.includes(idx);
            const canSelect = selectedQuestions.length < 3 || isSelected;

            return (
              <div key={idx}>
                <button
                  type="button"
                  onClick={() => canSelect && toggleQuestion(idx)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border ${
                    isSelected
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 font-medium"
                      : canSelect
                        ? "bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800"
                        : "bg-gray-50 dark:bg-slate-950 border-gray-100 dark:border-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <span className="inline-flex items-center">
                    <span
                      className={`w-5 h-5 rounded border mr-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && "✓"}
                    </span>
                    {q}
                  </span>
                </button>

                {/* Cevap alanı */}
                {isSelected && (
                  <input
                    type="text"
                    value={answers[idx] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))
                    }
                    className="mt-1 w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                    placeholder="Cevabınızı yazın..."
                    required
                  />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">
          {selectedQuestions.length}/3 soru seçildi
        </p>

        <button
          type="submit"
          disabled={saving || selectedQuestions.length < 3}
          className="w-full rounded-xl bg-amber-500 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Kaydediliyor..." : "Güvenlik Sorularını Kaydet"}
        </button>
      </form>
    </div>
  );
}
