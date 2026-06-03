"use client";

import { useState } from "react";
import { KeyRound, ArrowLeft, ShieldCheck, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

type Question = {
  questionId: number;
  question: string;
};

type Step = "email" | "questions" | "newPassword" | "success";

const passwordRules = [
  { test: (p: string) => p.length >= 8, label: "En az 8 karakter" },
  { test: (p: string) => /[A-Z]/.test(p), label: "En az bir büyük harf" },
  { test: (p: string) => /[a-z]/.test(p), label: "En az bir küçük harf" },
  { test: (p: string) => /[0-9]/.test(p), label: "En az bir rakam" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "En az bir özel karakter" },
];

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [resetToken, setResetToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ADIM 1: Email gönder → Güvenlik sorularını al
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir hata oluştu.");
        return;
      }

      if (data.step === "questions" && data.questions) {
        setQuestions(data.questions);
        const emptyAnswers: Record<number, string> = {};
        data.questions.forEach((q: Question) => {
          emptyAnswers[q.questionId] = "";
        });
        setAnswers(emptyAnswers);
        setStep("questions");
      }
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  // ADIM 2: Güvenlik sorularını doğrula → resetToken al
  async function handleAnswersSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const answerPayload = questions.map((q) => ({
      questionId: q.questionId,
      answer: answers[q.questionId] || "",
    }));

    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), answers: answerPayload }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cevaplar yanlış.");
        return;
      }

      if (data.step === "verified" && data.resetToken) {
        setResetToken(data.resetToken);
        setStep("newPassword");
      } else {
        setError("Doğrulama tamamlanamadı. Lütfen tekrar deneyin.");
      }
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  // ADIM 3: Yeni şifre belirle (resetToken ile)
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    if (!resetToken) {
      setError("Doğrulama tokenı eksik. Sıfırlamayı baştan başlat.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          // Backend step3'te answers'ı yine bekliyor (kontrolden geçmesi için),
          // ama asıl yetki resetToken ile veriliyor.
          answers: questions.map((q) => ({
            questionId: q.questionId,
            answer: answers[q.questionId] || "",
          })),
          resetToken,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Şifre değiştirilemedi.");
        return;
      }

      if (data.step === "success") {
        setStep("success");
      }
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  // Adım göstergesi (1-2-3)
  const stepNumber =
    step === "email" ? 1 : step === "questions" ? 2 : step === "newPassword" ? 3 : 3;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-200/60 overflow-hidden">
          {/* Üst şerit */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="p-8 sm:p-10">
            {/* Başlık */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                {step === "success" ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : step === "questions" ? (
                  <ShieldCheck className="w-6 h-6 text-white" />
                ) : (
                  <KeyRound className="w-6 h-6 text-white" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {step === "email" && "Şifremi Unuttum"}
                {step === "questions" && "Güvenlik Soruları"}
                {step === "newPassword" && "Yeni Şifre Belirle"}
                {step === "success" && "Şifre Değiştirildi"}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {step === "email" && "Kayıtlı e-posta adresini gir"}
                {step === "questions" && "Kimliğini doğrulamak için soruları cevapla"}
                {step === "newPassword" && "Yeni şifreni belirle"}
                {step === "success" && "Artık yeni şifrenle giriş yapabilirsin"}
              </p>
            </div>

            {/* Adım göstergesi */}
            {step !== "success" && (
              <div className="flex items-center justify-center gap-2 mb-6">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className={`h-1.5 rounded-full transition-all ${
                      n <= stepNumber
                        ? "w-10 bg-gradient-to-r from-blue-500 to-indigo-500"
                        : "w-6 bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Hata mesajı */}
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* ADIM 1: Email */}
            {step === "email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div>
                  <label htmlFor="fp-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                    E-posta Adresi
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                    placeholder="ornek@email.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 font-semibold text-white shadow-md shadow-blue-200 transition-all focus:outline-none focus:ring-3 focus:ring-blue-300 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Kontrol Ediliyor..." : "Devam Et"}
                </button>

                <div className="text-center">
                  <Link
                    href="/signin"
                    className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Giriş sayfasına dön
                  </Link>
                </div>
              </form>
            )}

            {/* ADIM 2: Güvenlik Soruları */}
            {step === "questions" && (
              <form onSubmit={handleAnswersSubmit} className="space-y-5">
                {questions.map((q, index) => (
                  <div key={q.questionId}>
                    <label htmlFor={`fp-q-${q.questionId}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                      {index + 1}. {q.question}
                    </label>
                    <input
                      id={`fp-q-${q.questionId}`}
                      type="text"
                      value={answers[q.questionId] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.questionId]: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                      placeholder="Cevabın..."
                      required
                    />
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 font-semibold text-white shadow-md shadow-blue-200 transition-all focus:outline-none focus:ring-3 focus:ring-blue-300 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Doğrulanıyor..." : "Cevapları Doğrula"}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setError("");
                    }}
                    className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Geri dön
                  </button>
                </div>
              </form>
            )}

            {/* ADIM 3: Yeni Şifre */}
            {step === "newPassword" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div>
                  <label htmlFor="fp-new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Yeni Şifre
                  </label>
                  <div className="relative">
                    <input
                      id="fp-new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-11 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                      placeholder="En az 8 karakter"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>

                  {newPassword.length > 0 && (
                    <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                      {passwordRules.map((rule) => {
                        const ok = rule.test(newPassword);
                        return (
                          <p
                            key={rule.label}
                            className={`flex items-center text-[11px] gap-1 ${
                              ok ? "text-emerald-600" : "text-slate-400"
                            }`}
                          >
                            <CheckCircle2
                              className={`w-3 h-3 shrink-0 ${
                                ok ? "text-emerald-500" : "text-slate-300"
                              }`}
                            />
                            {rule.label}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="fp-confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Şifreyi Tekrar Gir
                  </label>
                  <input
                    id="fp-confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm shadow-sm focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 outline-none transition"
                    placeholder="Şifreni tekrar gir"
                    required
                    autoComplete="new-password"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-500">Şifreler eşleşmiyor</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || newPassword !== confirmPassword}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 font-semibold text-white shadow-md shadow-blue-200 transition-all focus:outline-none focus:ring-3 focus:ring-blue-300 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Kaydediliyor..." : "Şifreyi Değiştir"}
                </button>
              </form>
            )}

            {/* ADIM 4: Başarılı */}
            {step === "success" && (
              <div className="text-center space-y-5">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-slate-600 text-sm">
                  Şifren başarıyla güncellendi. Artık yeni şifrenle giriş yapabilirsin.
                </p>
                <Link
                  href="/signin"
                  className="block w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 font-semibold text-white shadow-md shadow-blue-200 transition-all text-center"
                >
                  Giriş Yap
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
