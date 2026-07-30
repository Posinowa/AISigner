"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AuthField } from "@/features/auth/ui/AuthField";
import { AuthSubmitButton } from "@/features/auth/ui/AuthSubmitButton";
import { PasswordRules } from "@/features/auth/ui/PasswordRules";

export type Question = { questionId: number; question: string };

/** Adımlar arasında paylaşılan "geri dön" bağlantısı görünümü. */
const backLinkClass =
  "inline-flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors";

/** ADIM 1 — e-posta ile güvenlik sorularını iste. */
export function EmailStep({
  email,
  onEmailChange,
  onSubmit,
  loading,
}: {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AuthField
        id="fp-email"
        name="email"
        label="E-posta Adresi"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="ornek@email.com"
        required
        autoComplete="email"
      />

      <AuthSubmitButton pending={loading} label="Devam Et" pendingLabel="Kontrol Ediliyor..." />

      <div className="text-center">
        <Link href="/signin" className={backLinkClass}>
          <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" />
          Giriş sayfasına dön
        </Link>
      </div>
    </form>
  );
}

/** ADIM 2 — güvenlik sorularını cevapla. */
export function QuestionsStep({
  questions,
  answers,
  onAnswerChange,
  onSubmit,
  onBack,
  loading,
}: {
  questions: Question[];
  answers: Record<number, string>;
  onAnswerChange: (questionId: number, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {questions.map((q, index) => (
        <AuthField
          key={q.questionId}
          id={`fp-q-${q.questionId}`}
          name={`answer-${q.questionId}`}
          label={`${index + 1}. ${q.question}`}
          value={answers[q.questionId] || ""}
          onChange={(e) => onAnswerChange(q.questionId, e.target.value)}
          placeholder="Cevabın..."
          required
          autoComplete="off"
        />
      ))}

      <AuthSubmitButton
        pending={loading}
        label="Cevapları Doğrula"
        pendingLabel="Doğrulanıyor..."
      />

      <div className="text-center">
        <button type="button" onClick={onBack} className={backLinkClass}>
          <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" />
          Geri dön
        </button>
      </div>
    </form>
  );
}

/** ADIM 3 — yeni şifreyi belirle. */
export function NewPasswordStep({
  newPassword,
  confirmPassword,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  loading,
}: {
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}) {
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AuthField
        id="fp-new-password"
        name="newPassword"
        label="Yeni Şifre"
        revealable
        value={newPassword}
        onChange={(e) => onNewPasswordChange(e.target.value)}
        placeholder="En az 8 karakter"
        required
        minLength={8}
        autoComplete="new-password"
        belowField={<PasswordRules password={newPassword} />}
      />

      <AuthField
        id="fp-confirm-password"
        name="confirmPassword"
        label="Şifreyi Tekrar Gir"
        revealable
        value={confirmPassword}
        onChange={(e) => onConfirmPasswordChange(e.target.value)}
        placeholder="Şifreni tekrar gir"
        required
        autoComplete="new-password"
        // #156: Eşleşmeme uyarısı artık alanın kendi hatası — aria-describedby
        // ile input'a bağlanıyor ve role="alert" ile duyuruluyor.
        errors={mismatch ? ["Şifreler eşleşmiyor"] : undefined}
      />

      <AuthSubmitButton
        pending={loading}
        label="Şifreyi Değiştir"
        pendingLabel="Kaydediliyor..."
      />
    </form>
  );
}

/** ADIM 4 — başarı ekranı. */
export function SuccessStep() {
  return (
    <div className="text-center space-y-5">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      </div>
      <p className="text-slate-600 dark:text-slate-300 text-sm">
        Şifren başarıyla güncellendi. Artık yeni şifrenle giriş yapabilirsin.
      </p>
      <Link
        href="/signin"
        className="block w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 font-semibold text-white shadow-md shadow-blue-200 transition-all text-center"
      >
        Giriş Yap
      </Link>
    </div>
  );
}
