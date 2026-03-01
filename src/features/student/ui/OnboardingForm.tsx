"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod"; // 🚀 Zod'u içeri aktarıyoruz
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveOnboarding } from "@/features/student/server/onboarding";
import { CheckCircle, User, Target, Award, ArrowRight, ArrowLeft, Rocket, Terminal, BookOpen, Clock } from "lucide-react";

import type { FieldPath } from "react-hook-form";

// 🚀 SPRINT 4: Yapay Zekayı Besleyecek Gelişmiş Şema (Local Schema)
const enhancedSchema = z.object({
  personal: z.object({
    firstName: z.string().min(2, "Ad en az 2 karakter olmalıdır"),
    lastName: z.string().min(2, "Soyad en az 2 karakter olmalıdır"),
    birthYear: z.number().min(1950).max(2015, "Geçerli bir yıl giriniz"),
    phoneNumber: z.string().min(10, "Geçerli bir telefon numarası giriniz"),
  }),
  experience: z.object({
    level: z.string().min(1, "Lütfen bir seviye seçin"),
    knownTech: z.string().min(10, "Lütfen bildiklerinizi kısaca özetleyin"), // YENİ
  }),
  vision: z.object({
    interest: z.array(z.string()).min(1, "En az bir ilgi alanı seçmelisiniz"),
    futureGoal: z.string().min(10, "Lütfen gelecekteki hedefinizi yazın"), // YENİ
  }),
  workingStyle: z.object({
    learningStyle: z.string().min(10, "Lütfen nasıl öğrenmeyi sevdiğinizi yazın"), // YENİ
    availability: z.string().min(1, "Lütfen uygunluğunuzu seçin"),
  }),
});

type EnhancedFormData = z.infer<typeof enhancedSchema>;

// Form Adımları (4 Adıma çıkarıldı)
const steps = [
  { id: 0, title: "Kişisel Bilgiler", icon: User, description: "Sizi daha iyi tanıyalım" },
  { id: 1, title: "Altyapı & Deneyim", icon: Terminal, description: "Mevcut bilgi birikiminiz nedir?" },
  { id: 2, title: "Vizyon & Hedefler", icon: Rocket, description: "Gelecekte nerede olmak istiyorsunuz?" },
  { id: 3, title: "Çalışma Tarzı", icon: BookOpen, description: "Sizin için en iyi öğrenme yöntemi nedir?" }
];

const experienceLevels = [
  { value: "beginner", label: "Sıfırdan Başlıyorum", description: "Yazılıma dair henüz temel bir bilgim yok." },
  { value: "intermediate", label: "Temelim Var", description: "Değişkenler, döngüler ve temel algoritmaları biliyorum." },
  { value: "advanced", label: "Projeler Geliştirdim", description: "Bir framework/dil ile kendi çapımda projeler yaptım." }
];

const availabilityOptions = [
  { value: "full-time", label: "Tam Zamanlı", description: "Hafta içi her gün yoğun vakit ayırabilirim." },
  { value: "part-time", label: "Yarı Zamanlı", description: "Okuldan/İşten arta kalan vakitlerde ilgilenebilirim." },
  { value: "weekends", label: "Hafta Sonları", description: "Sadece hafta sonları odaklanabilirim." }
];

const interests = [
  { id: "AI", label: "Yapay Zeka & Veri", emoji: "🤖" },
  { id: "Web Development", label: "Web Geliştirme", emoji: "💻" },
  { id: "Mobile", label: "Mobil Geliştirme", emoji: "📱" },
  { id: "Game Dev", label: "Oyun Geliştirme", emoji: "🎮" },
  { id: "Cybersecurity", label: "Siber Güvenlik", emoji: "🛡️" }
];

export default function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, trigger, formState: { errors } } = useForm<EnhancedFormData>({
    resolver: zodResolver(enhancedSchema),
    mode: "onChange",
    defaultValues: {
      personal: { firstName: "", lastName: "", birthYear: undefined, phoneNumber: "" },
      experience: { level: "", knownTech: "" },
      vision: { interest: [], futureGoal: "" },
      workingStyle: { learningStyle: "", availability: "" },
    },
  });

  const stepFields: FieldPath<EnhancedFormData>[][] = [
    ["personal.firstName", "personal.lastName", "personal.birthYear", "personal.phoneNumber"],
    ["experience.level", "experience.knownTech"],
    ["vision.interest", "vision.futureGoal"],
    ["workingStyle.learningStyle", "workingStyle.availability"],
  ];

  const onNext = async () => {
    const valid = await trigger(stepFields[step]);
    if (!valid) return;
    setStep((s) => s + 1);
  };

  const onBack = () => setStep((s) => s - 1);

  // 🚀 ZEKİCE KISIM: Verileri AI için birleştirip tek bir alana gömüyoruz
  const onFinalSubmit = async (data: EnhancedFormData) => {
    try {
      setIsSubmitting(true);
      
      const compiledAIContext = `
[MEVCUT BİLGİ BİRİKİMİ]: ${data.experience.knownTech}
[GELECEK VİZYONU VE HEDEFLER]: ${data.vision.futureGoal}
[ÖĞRENME VE ÇALIŞMA STİLİ]: ${data.workingStyle.learningStyle}
      `.trim();

      // Eski backendin bozulmaması için veriyi onun beklediği formata çeviriyoruz
      const backendPayload = {
        personal: data.personal,
        experience: {
          level: data.experience.level,
          interest: data.vision.interest,
        },
        goals: {
          availability: data.workingStyle.availability,
          goal: compiledAIContext, // 🧠 AI bu metne bayılacak!
        }
      };

      await saveOnboarding(backendPayload as any);
      
      // Başarılı olursa yönlendirme yapılabilir.
      window.location.href = "/student-dashboard"; 
      
    } catch (err) {
      console.error("Onboarding kaydı başarısız:", err);
      alert("Kayıt sırasında bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Hoş Geldiniz!</h1>
          <p className="text-gray-600">Mentorünüzün ve Yapay Zekanın size en uygun rotayı çizebilmesi için soruları detaylı yanıtlayın.</p>
        </div>

        {/* Steps Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 px-4">
            {steps.map((s, index) => (
              <div key={s.id} className="flex flex-col items-center relative w-full">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 z-10 bg-white transition-all duration-300 ${
                  index <= step ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400'
                }`}>
                  {index < step ? <CheckCircle className="w-6 h-6 text-blue-600" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-medium mt-2 hidden sm:block ${index <= step ? 'text-blue-700' : 'text-gray-400'}`}>
                  {s.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={`absolute top-6 left-[50%] w-full h-[2px] -z-0 transition-all duration-300 ${
                    index < step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-10 border border-gray-100">
          <form onSubmit={handleSubmit(onFinalSubmit)} className="space-y-6">
            
            <div className="text-center mb-10 pb-6 border-b border-gray-100">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-4 shadow-sm">
                <currentStep.icon className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentStep.title}</h2>
              <p className="text-gray-500">{currentStep.description}</p>
            </div>

            {/* ADIM 0: KİŞİSEL BİLGİLER */}
            {step === 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Adınız</label>
                    <Input {...register("personal.firstName")} className="h-12 bg-gray-50" placeholder="Örn: Ali" />
                    {errors.personal?.firstName && <p className="text-red-500 text-xs">{errors.personal.firstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Soyadınız</label>
                    <Input {...register("personal.lastName")} className="h-12 bg-gray-50" placeholder="Örn: Yılmaz" />
                    {errors.personal?.lastName && <p className="text-red-500 text-xs">{errors.personal.lastName.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Doğum Yılı</label>
                    <Input type="number" {...register("personal.birthYear", { valueAsNumber: true })} className="h-12 bg-gray-50" placeholder="Örn: 2002" />
                    {errors.personal?.birthYear && <p className="text-red-500 text-xs">{errors.personal.birthYear.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Telefon Numaranız</label>
                    <Input {...register("personal.phoneNumber")} className="h-12 bg-gray-50" placeholder="Örn: 0555 123 45 67" />
                    {errors.personal?.phoneNumber && <p className="text-red-500 text-xs">{errors.personal.phoneNumber.message}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ADIM 1: DENEYİM VE ALTYAPI */}
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Deneyim Seviyeniz
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    {experienceLevels.map((level) => (
                      <label key={level.value} className="relative">
                        <input type="radio" value={level.value} {...register("experience.level")} className="sr-only peer" />
                        <div className="p-5 h-full border-2 border-gray-100 rounded-xl cursor-pointer hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50 transition-all text-center">
                          <h3 className="font-bold text-gray-900 mb-2">{level.label}</h3>
                          <p className="text-xs text-gray-500 leading-relaxed">{level.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.experience?.level && <p className="text-red-500 text-xs">{errors.experience.level.message}</p>}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Şu ana kadar neler öğrendiniz / denediniz? (AI için çok önemli 🤖)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Lütfen bildiğiniz dilleri, araçları veya kendi başınıza denediğiniz şeyleri dürüstçe yazın. (Örn: "Üniversitede C++ gördüm, HTML/CSS ile basit bir site yaptım ama JavaScript'te zorlanıyorum.")
                  </p>
                  <textarea
                    {...register("experience.knownTech")}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none resize-none transition-all"
                    placeholder="Bildiğiniz teknolojileri ve mevcut durumunuzu anlatın..."
                  />
                  {errors.experience?.knownTech && <p className="text-red-500 text-xs">{errors.experience.knownTech.message}</p>}
                </div>
              </div>
            )}

            {/* ADIM 2: İLGİ ALANLARI VE VİZYON */}
            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Hangi alanlara ilgi duyuyorsunuz? (Birden fazla seçilebilir)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {interests.map((interest) => (
                      <label key={interest.id} className="relative">
                        <input type="checkbox" value={interest.id} {...register("vision.interest")} className="sr-only peer" />
                        <div className="p-3 border-2 border-gray-100 rounded-xl cursor-pointer hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50 transition-all flex items-center gap-2">
                          <span className="text-xl">{interest.emoji}</span>
                          <span className="font-medium text-sm text-gray-800">{interest.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.vision?.interest && <p className="text-red-500 text-xs">{errors.vision.interest.message}</p>}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Gelecekte ne tür projeler yapmak istiyorsunuz?
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Önümüzdeki 1 yıl içinde neleri başarmak istersiniz? (Örn: "Kendi e-ticaret sitemi kurmak istiyorum" veya "Bir yapay zeka modelini mobil uygulamaya entegre etmek istiyorum.")
                  </p>
                  <textarea
                    {...register("vision.futureGoal")}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none resize-none transition-all"
                    placeholder="Hayalinizdeki projeleri ve hedeflerinizi detaylandırın..."
                  />
                  {errors.vision?.futureGoal && <p className="text-red-500 text-xs">{errors.vision.futureGoal.message}</p>}
                </div>
              </div>
            )}

            {/* ADIM 3: ÇALIŞMA TARZI VE ZAMAN */}
            {step === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">
                    Sizin için en iyi öğrenme yöntemi nedir?
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Size bir proje verildiğinde nasıl ilerlemeyi seversiniz? (Örn: "Adım adım, doküman okuyarak ilerlemeyi severim" veya "Hata yapa yapa, direkt kod yazarak öğrenmek isterim.")
                  </p>
                  <textarea
                    {...register("workingStyle.learningStyle")}
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none resize-none transition-all"
                    placeholder="Nasıl bir çalışma tarzı sizi daha verimli yapar?"
                  />
                  {errors.workingStyle?.learningStyle && <p className="text-red-500 text-xs">{errors.workingStyle.learningStyle.message}</p>}
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700">
                    Projeler için ayırabileceğiniz vakit
                  </label>
                  <div className="grid gap-4 md:grid-cols-3">
                    {availabilityOptions.map((option) => (
                      <label key={option.value} className="relative">
                        <input type="radio" value={option.value} {...register("workingStyle.availability")} className="sr-only peer" />
                        <div className="p-5 h-full border-2 border-gray-100 rounded-xl cursor-pointer hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50 transition-all text-center">
                          <Clock className={`w-6 h-6 mx-auto mb-2 ${option.value === "full-time" ? "text-red-500" : option.value === "part-time" ? "text-yellow-500" : "text-green-500"}`} />
                          <h3 className="font-bold text-gray-900 mb-1">{option.label}</h3>
                          <p className="text-xs text-gray-500 leading-relaxed">{option.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.workingStyle?.availability && <p className="text-red-500 text-xs">{errors.workingStyle.availability.message}</p>}
                </div>
              </div>
            )}

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
              
              {step < steps.length - 1 ? (
                <Button 
                  type="button" 
                  onClick={onNext}
                  className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-md shadow-blue-200"
                >
                  Sonraki Adım <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="h-12 px-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" /> Kaydediliyor...</>
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