"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod"; // 🚀 Zod'u içeri aktarıyoruz
import { OnboardingAdimIcerigi } from "@/features/student/ui/OnboardingAdimIcerigi";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveOnboarding } from "@/features/student/server/onboarding";
import { CheckCircle, User, GraduationCap, ArrowRight, ArrowLeft, Rocket, Terminal, BookOpen, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildSurveyAnswerPayload, extractSurveyErrorMessage, type SurveyQuestionView } from "@/features/survey/answers";
import { compileGoals } from "@/features/student/models/compiledGoals";
import { buildOnboardingDefaultValues, shouldShowSurveyStep, type OnboardingInitialValues } from "@/features/student/models/onboardingInitial";

import type { FieldPath } from "react-hook-form";
import { DOGUM_YILI_EN_ERKEN, dogumYiliEnGec, HAFTALIK_SAAT_EN_AZ, HAFTALIK_SAAT_EN_COK } from "@/features/student/models/secenekler";

// 🚀 SPRINT 4: Yapay Zekayı Besleyecek Gelişmiş Şema (Local Schema)
// #289: Başvuru soruları genişletildi. Sınırlar `models/secenekler`ten geliyor —
// doğum yılı önceden burada max(2015), sunucu şemasında ise mevcut yıl olarak
// İKİ FARKLI yerde sınırlanıyordu.
const enhancedSchema = z.object({
  personal: z.object({
    firstName: z.string().min(2, "Ad en az 2 karakter olmalıdır"),
    lastName: z.string().min(2, "Soyad en az 2 karakter olmalıdır"),
    birthYear: z
      .number()
      .min(DOGUM_YILI_EN_ERKEN, `${DOGUM_YILI_EN_ERKEN} yılından sonrasını girin`)
      .max(dogumYiliEnGec(), "Geçerli bir doğum yılı giriniz"),
    phoneNumber: z.string().min(10, "Geçerli bir telefon numarası giriniz"),
    city: z.string().min(2, "Yaşadığın ili yaz"),
  }),
  education: z.object({
    school: z.string().min(2, "Okulunu yaz"),
    department: z.string().min(2, "Bölümünü yaz"),
    classYear: z.string().min(1, "Sınıfını seç"),
    englishLevel: z.string().min(1, "İngilizce seviyeni seç"),
  }),
  experience: z.object({
    level: z.string().min(1, "Lütfen bir seviye seçin"),
    gitLevel: z.string().min(1, "Git deneyimini seç"),
    knownTech: z.string().min(10, "Lütfen bildiklerinizi kısaca özetleyin"),
  }),
  vision: z.object({
    interest: z.array(z.string()).min(1, "En az bir ilgi alanı seçmelisiniz"),
    futureGoal: z.string().min(10, "Lütfen gelecekteki hedefinizi yazın"),
  }),
  workingStyle: z.object({
    learningStyle: z.string().min(10, "Lütfen nasıl öğrenmeyi sevdiğinizi yazın"),
    weeklyHours: z
      .number({ message: "Haftalık saat giriniz" })
      .min(HAFTALIK_SAAT_EN_AZ, `En az ${HAFTALIK_SAAT_EN_AZ} saat`)
      .max(HAFTALIK_SAAT_EN_COK, `En fazla ${HAFTALIK_SAAT_EN_COK} saat`),
  }),
});

export type EnhancedFormData = z.infer<typeof enhancedSchema>;

// Form Adımları (4 Adıma çıkarıldı)
// #289: Eğitim adımı eklendi — 4 adım 5'e çıktı.
const steps = [
  { id: 0, title: "Kişisel Bilgiler", icon: User, description: "Sizi daha iyi tanıyalım" },
  { id: 1, title: "Eğitim", icon: GraduationCap, description: "Nerede okuyorsunuz?" },
  { id: 2, title: "Altyapı & Deneyim", icon: Terminal, description: "Mevcut bilgi birikiminiz nedir?" },
  { id: 3, title: "Vizyon & Hedefler", icon: Rocket, description: "Gelecekte nerede olmak istiyorsunuz?" },
  { id: 4, title: "Çalışma Tarzı", icon: BookOpen, description: "Sizin için en iyi öğrenme yöntemi nedir?" }
];







export default function OnboardingForm({
  initial,
  surveyQuestions = [],
  surveyLoadFailed = false,
}: {
  initial?: OnboardingInitialValues;
  surveyQuestions?: SurveyQuestionView[];
  /** #83: Sorular admin tarafından tanımlanmamış (gerçek boş) mu, yoksa fetch mi
   *  başarısız oldu? İkisi de surveyQuestions=[] ile sonuçlanır; bu flag onları
   *  ayırt eder — fetch hatasında adım gizlenmez, açık bir hata mesajı gösterir. */
  surveyLoadFailed?: boolean;
} = {}) {
  // #46: Admin anket soruları varsa forma ek bir "Ek Sorular" adımı eklenir.
  // #83: Sorular yüklenemediyse de (gerçek boş değilse) adım gösterilir — kullanıcı
  // hatayı görsün, adımın "hiç soru yokmuş" gibi sessizce kaybolması yerine.
  const hasSurvey = shouldShowSurveyStep(surveyQuestions.length, surveyLoadFailed);
  const allSteps = hasSurvey
    ? [
        ...steps,
        { id: steps.length, title: "Ek Sorular", icon: ClipboardList, description: "Mentörünüz için birkaç ek soru" },
      ]
    : steps;

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Adım geçişinde form kartını üste kaydır — kullanıcı yeni adımın ortasından
  // değil başından (başlık + ilk alan) görsün (#10).
  const topRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);
  // Anket cevapları (questionId → cevap). RHF dışında tutulur çünkü sorular dinamiktir.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Her adım için "kullanıcı bu adımda Sonraki Adım'a bastı mı?" flag'i.
  // zodResolver tüm form'u parse ettiği için trigger() çağrılmasa bile
  // errors objesi diğer adımların alanlarıyla dolar; bu flag ile sadece
  // ilgilendiği adımda Sonraki/Tamamla'ya bastıktan sonra hata gösteririz.
  const [stepAttempted, setStepAttempted] = useState<boolean[]>(() =>
    new Array(allSteps.length).fill(false),
  );

  const { register, handleSubmit, trigger, clearErrors, formState: { errors } } = useForm<EnhancedFormData>({
    resolver: zodResolver(enhancedSchema),
    mode: "onSubmit",
    // #55/#115: Prefill eşlemesi (compiled goals ayrıştırma + experienceLevel map)
    // test edilen saf fonksiyonda — bkz. models/onboardingInitial.ts
    defaultValues: buildOnboardingDefaultValues(initial),
  });

    const stepFields: FieldPath<EnhancedFormData>[][] = [
    ["personal.firstName", "personal.lastName", "personal.birthYear", "personal.phoneNumber", "personal.city"],
    ["education.school", "education.department", "education.classYear", "education.englishLevel"],
    ["experience.level", "experience.gitLevel", "experience.knownTech"],
    ["vision.interest", "vision.futureGoal"],
    ["workingStyle.learningStyle", "workingStyle.weeklyHours"],
  ];

  const onNext = async () => {
    // Bu adımda Sonraki'ye basıldı — artık hatalar gösterilebilir
    setStepAttempted((prev) => {
      const next = [...prev];
      next[step] = true;
      return next;
    });
    const valid = await trigger(stepFields[step]);
    if (!valid) return;
    // Bir sonraki adıma geçmeden önce tüm hataları temizle.
    // zodResolver tüm şemayı parse ettiğinden trigger() sonraki adımların
    // hatalarını da errors objesine yazabilir; clearErrors() bunu engeller.
    clearErrors();
    setStep((s) => s + 1);
  };

  // Submit denemesinde tüm adımlar için hata göster
  const markAllStepsAttempted = () =>
    setStepAttempted(allSteps.map(() => true));

  const onBack = () => setStep((s) => s - 1);

  // 🚀 ZEKİCE KISIM: Verileri AI için birleştirip tek bir alana gömüyoruz
  const onFinalSubmit = async (data: EnhancedFormData) => {
    try {
      setIsSubmitting(true);
      
      // #55: compileGoals — parseCompiledGoals ile aynı formatı kullanır (prefill
      // round-trip'i bozulmasın diye derleme mantığı tek yerde tutuluyor).
      const compiledAIContext = compileGoals({
        knownTech: data.experience.knownTech,
        futureGoal: data.vision.futureGoal,
        learningStyle: data.workingStyle.learningStyle,
      });

      // #289: Yeni alanlar sunucuya AYRI gönderiliyor; serbest metinler
      // eskisi gibi tek bir `goals` dizesine derleniyor (prefill round-trip'i
      // bozulmasın diye derleme mantığı compileGoals'ta tek yerde).
      const backendPayload = {
        personal: data.personal,
        education: data.education,
        experience: {
          level: data.experience.level,
          gitLevel: data.experience.gitLevel,
          interest: data.vision.interest,
        },
        goals: {
          weeklyHours: data.workingStyle.weeklyHours,
          goal: compiledAIContext,
        },
      };

      await saveOnboarding(backendPayload);

      // #46: Anket cevapları (varsa) profile kaydedildikten sonra gönderilir.
      // Profil oluştuğundan saveSurveyAnswers profili bulabilir. Cevaplar opsiyonel:
      // hiç doldurulmadıysa istek atılmaz.
      const surveyPayload = buildSurveyAnswerPayload(answers);
      if (surveyPayload.length > 0) {
        const res = await fetch("/api/student/survey-answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: surveyPayload }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          // #83: Hata hem düz string (SurveyValidationError/500) hem zod fieldErrors
          // objesi (400 validation) olarak gelebilir — ikisi de doğru gösterilsin.
          toast.error(extractSurveyErrorMessage(data?.error, "Anket cevapları kaydedilemedi."));
          return; // Profil kaydedildi; kullanıcı cevapları tekrar gönderebilir.
        }
      }

      // Başarılı olursa yönlendirme yapılabilir.
      // #143: Profil tamamlandı → durum ekranına. PENDING kullanıcı "inceleniyor /
      // mentör atanıyor" mesajını görür; APPROVED kullanıcıyı sayfa zaten kendi
      // paneline yönlendirir (tek hedef, iki durum da doğru çalışır).
      window.location.href = "/account-status";

    } catch (err) {
      console.error("Onboarding kaydı başarısız:", err);
      toast.error("Kayıt sırasında bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStep = allSteps[step];
  const progress = ((step + 1) / allSteps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div ref={topRef} className="max-w-3xl mx-auto scroll-mt-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Hoş Geldiniz!</h1>
          <p className="text-gray-600">Mentorünüzün ve Yapay Zekanın size en uygun rotayı çizebilmesi için soruları detaylı yanıtlayın.</p>
        </div>

        {/* Steps Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 px-4">
            {allSteps.map((s, index) => (
              <div key={s.id} className="flex flex-col items-center relative w-full">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 z-10 bg-white transition-all duration-300 ${
                  index <= step ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400'
                }`}>
                  {index < step ? <CheckCircle className="w-6 h-6 text-blue-600" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-medium mt-2 hidden sm:block ${index <= step ? 'text-blue-700 ' : 'text-gray-400 '}`}>
                  {s.title}
                </span>
                {index < allSteps.length - 1 && (
                  <div className={`absolute top-6 left-[50%] w-full h-[2px] -z-0 transition-all duration-300 ${
                    index < step ? 'bg-primary' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10 border border-gray-100">
          <form
            onSubmit={handleSubmit(onFinalSubmit, () => markAllStepsAttempted())}
            className="space-y-6"
          >
            
            <div className="text-center mb-10 pb-6 border-b border-gray-100">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-4 shadow-sm">
                <currentStep.icon className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentStep.title}</h2>
              <p className="text-gray-500">{currentStep.description}</p>
            </div>

            <OnboardingAdimIcerigi step={step} register={register} errors={errors} surveyQuestions={surveyQuestions} answers={answers} setAnswers={setAnswers} stepAttempted={stepAttempted} hasSurvey={hasSurvey} surveyLoadFailed={surveyLoadFailed} sonAdimIndex={allSteps.length - 1} />

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-8 border-t border-gray-100">
              <Button 
                type="button" 
                onClick={onBack}
                variant="outline"
                className={`h-12 px-6 rounded-xl border-gray-200 hover:bg-gray-50 transition-all ${step === 0 ? 'invisible' : 'visible'}`}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Geri
              </Button>
              
              {step < allSteps.length - 1 ? (
                <Button
                  type="button"
                  onClick={onNext}
                  className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all shadow-md shadow-primary"
                >
                  Sonraki Adım <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="h-12 px-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all shadow-lg shadow-primary disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-3" /> Kaydediliyor...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5 mr-2" /> Kaydı Tamamla</>
                  )}
                </Button>
              )}
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}