"use client";

import { useState } from "react";
import { KeyRound, ArrowLeft, ShieldCheck, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

type Question = {
  questionId: number;
  question: string;
};

type Step = "email" | "questions" | "newPassword" | "success";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
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
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir hata oluştu.");
        return;
      }

      if (data.step === "questions" && data.questions) {
        setQuestions(data.questions);
        // Cevapları boş olarak hazırla
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

  // ADIM 2: Güvenlik sorularını doğrula
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
        body: JSON.stringify({ email: email.trim(), answers: answerPayload }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cevaplar yanlış.");
        return;
      }

      if (data.step === "verified") {
        setStep("newPassword");
      }
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  // ADIM 3: Yeni şifre belirle
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);

    const answerPayload = questions.map((q) => ({
      questionId: q.questionId,
      answer: answers[q.questionId] || "",
    }));

    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          answers: answerPayload,
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-gray-200">
        {/* Başlık */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
            {step === "success" ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : step === "questions" ? (
              <ShieldCheck className="w-6 h-6 text-white" />
            ) : (
              <KeyRound className="w-6 h-6 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            {step === "email" && "Şifremi Unuttum"}
            {step === "questions" && "Güvenlik Soruları"}
            {step === "newPassword" && "Yeni Şifre Belirle"}
            {step === "success" && "Şifre Değiştirildi!"}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {step === "email" && "Kayıtlı email adresinizi girin"}
            {step === "questions" && "Kimliğinizi doğrulamak için soruları cevaplayın"}
            {step === "newPassword" && "Yeni şifrenizi belirleyin"}
            {step === "success" && "Artık yeni şifrenizle giriş yapabilirsiniz"}
          </p>
        </div>

        {/* Hata mesajı */}
        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 shadow-inner">
            {error}
          </div>
        )}

        {/* ADIM 1: Email */}
        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email Adresiniz
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100 outline-none transition"
                placeholder="ornek@email.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-amber-600 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? "Kontrol Ediliyor..." : "Devam Et"}
            </button>

            <div className="text-center">
              <Link href="/signin" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
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
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {index + 1}. {q.question}
                </label>
                <input
                  type="text"
                  value={answers[q.questionId] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.questionId]: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100 outline-none transition"
                  placeholder="Cevabınız..."
                  required
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-amber-600 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? "Doğrulanıyor..." : "Cevapları Doğrula"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setStep("email"); setError(""); }}
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
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
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Yeni Şifre
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 pr-10 text-gray-800 shadow-sm focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100 outline-none transition"
                  placeholder="En az 8 karakter"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <p className={newPassword.length >= 8 ? "text-green-600" : "text-gray-400"}>
                  ✓ En az 8 karakter
                </p>
                <p className={/[A-Z]/.test(newPassword) ? "text-green-600" : "text-gray-400"}>
                  ✓ En az bir büyük harf
                </p>
                <p className={/[a-z]/.test(newPassword) ? "text-green-600" : "text-gray-400"}>
                  ✓ En az bir küçük harf
                </p>
                <p className={/[0-9]/.test(newPassword) ? "text-green-600" : "text-gray-400"}>
                  ✓ En az bir rakam
                </p>
                <p className={/[^A-Za-z0-9]/.test(newPassword) ? "text-green-600" : "text-gray-400"}>
                  ✓ En az bir özel karakter
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Şifreyi Tekrar Girin
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 shadow-sm focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100 outline-none transition"
                placeholder="Şifrenizi tekrar girin"
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">Şifreler eşleşmiyor</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || newPassword !== confirmPassword}
              className="w-full rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-amber-600 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? "Kaydediliyor..." : "Şifreyi Değiştir"}
            </button>
          </form>
        )}

        {/* ADIM 4: Başarılı */}
        {step === "success" && (
          <div className="text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-gray-600">
              Şifreniz başarıyla güncellendi. Artık yeni şifrenizle giriş yapabilirsiniz.
            </p>
            <Link
              href="/signin"
              className="inline-block w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg text-center"
            >
              Giriş Yap
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
