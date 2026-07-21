"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, ShieldCheck, CheckCircle2 } from "lucide-react";
import { AuthCard } from "@/features/auth/ui/AuthCard";
import { FormAlert } from "@/features/auth/ui/FormAlert";
import { StepIndicator } from "@/features/auth/ui/StepIndicator";
import {
  EmailStep,
  QuestionsStep,
  NewPasswordStep,
  SuccessStep,
  type Question,
} from "@/features/auth/ui/forgot-password/steps";

type Step = "email" | "questions" | "newPassword" | "success";

const VERIFY_URL = "/api/auth/forgot-password/verify";

/** Adım başına başlık/ikon — render içinde dağılmasın diye tek yerde. */
const stepMeta: Record<Step, { icon: typeof KeyRound; title: string; subtitle: string }> = {
  email: {
    icon: KeyRound,
    title: "Şifremi Unuttum",
    subtitle: "Kayıtlı e-posta adresini gir",
  },
  questions: {
    icon: ShieldCheck,
    title: "Güvenlik Soruları",
    subtitle: "Kimliğini doğrulamak için soruları cevapla",
  },
  newPassword: {
    icon: KeyRound,
    title: "Yeni Şifre Belirle",
    subtitle: "Yeni şifreni belirle",
  },
  success: {
    icon: CheckCircle2,
    title: "Şifre Değiştirildi",
    subtitle: "Artık yeni şifrenle giriş yapabilirsin",
  },
};

const stepNumber: Record<Step, number> = {
  email: 1,
  questions: 2,
  newPassword: 3,
  success: 3,
};

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // #156: Adım değişince odağı başlığa taşı. Önceden basılan düğme DOM'dan
  // silindiği için odak <body>'ye düşüyordu: klavyeyle gezen kullanıcı yeni
  // alanlara ulaşmak için baştan tab'lamak zorunda kalıyor, ekran okuyucu
  // kullanan ise sayfanın değiştiğini hiç fark etmiyordu.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      // İlk açılışta odağı çalmayalım — kullanıcı henüz bir şey yapmadı.
      isFirstRender.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [step]);

  /** Üç adım da aynı uca POST atıyor; ortak sarmalayıcı. */
  async function postVerify(body: Record<string, unknown>) {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim(), ...body }),
    });
    return { res, data: await res.json().catch(() => null) };
  }

  /** Sunucunun beklediği cevap dizisi — 2. ve 3. adımda aynı şekilde gidiyor. */
  function answerPayload() {
    return questions.map((q) => ({
      questionId: q.questionId,
      answer: answers[q.questionId] || "",
    }));
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { res, data } = await postVerify({});
      if (!res.ok) {
        setError(data?.error || "Bir hata oluştu.");
        return;
      }

      if (data?.step === "questions" && data.questions) {
        setQuestions(data.questions);
        const empty: Record<number, string> = {};
        data.questions.forEach((q: Question) => {
          empty[q.questionId] = "";
        });
        setAnswers(empty);
        setStep("questions");
      }
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswersSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { res, data } = await postVerify({ answers: answerPayload() });
      if (!res.ok) {
        setError(data?.error || "Cevaplar yanlış.");
        return;
      }

      if (data?.step === "verified" && data.resetToken) {
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
      // Sunucu 3. adımda cevapları yeniden doğruluyor; resetToken ek kanıt.
      const { res, data } = await postVerify({
        answers: answerPayload(),
        resetToken,
        newPassword,
      });

      if (!res.ok) {
        setError(data?.error || "Şifre değiştirilemedi.");
        return;
      }
      if (data?.step === "success") {
        setStep("success");
      }
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  const meta = stepMeta[step];

  return (
    <AuthCard
      icon={meta.icon}
      title={meta.title}
      subtitle={meta.subtitle}
      titleRef={titleRef}
    >
      {step !== "success" && <StepIndicator current={stepNumber[step]} total={3} />}

      {error && (
        <div className="mb-4">
          <FormAlert variant="error">{error}</FormAlert>
        </div>
      )}

      {step === "email" && (
        <EmailStep
          email={email}
          onEmailChange={setEmail}
          onSubmit={handleEmailSubmit}
          loading={loading}
        />
      )}

      {step === "questions" && (
        <QuestionsStep
          questions={questions}
          answers={answers}
          onAnswerChange={(questionId, value) =>
            setAnswers((prev) => ({ ...prev, [questionId]: value }))
          }
          onSubmit={handleAnswersSubmit}
          onBack={() => {
            setStep("email");
            setError("");
          }}
          loading={loading}
        />
      )}

      {step === "newPassword" && (
        <NewPasswordStep
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handlePasswordSubmit}
          loading={loading}
        />
      )}

      {step === "success" && <SuccessStep />}
    </AuthCard>
  );
}
