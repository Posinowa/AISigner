"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, OnboardingFormData } from "@/features/student/models/onboarding";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveOnboarding } from "@/features/student/server/onboarding";
import { CheckCircle, User, Target, Award, ArrowRight, ArrowLeft } from "lucide-react";

import type { FieldPath } from "react-hook-form";

const steps = [
  { id: 0, title: "Kişisel Bilgiler", icon: User, description: "Sizi daha iyi tanıyalım" },
  { id: 1, title: "Deneyim", icon: Award, description: "Seviyenizi ve ilgi alanlarınızı belirleyin" },
  { id: 2, title: "Hedefler", icon: Target, description: "Öğrenme hedeflerinizi paylaşın" }
];

const experienceLevels = [
  { value: "beginner", label: "Yeni Başlayan", description: "Henüz başlangıç seviyesindeyim" },
  { value: "intermediate", label: "Orta Seviye", description: "Temel bilgilere sahibim" },
  { value: "advanced", label: "İleri Seviye", description: "Deneyimli ve ilerlemek istiyorum" }
];

const availabilityOptions = [
  { value: "full-time", label: "Tam zamanlı", description: "Hafta içi her gün uygunum" },
  { value: "part-time", label: "Yarı zamanlı", description: "Haftada birkaç gün uygunum" },
  { value: "weekends", label: "Hafta sonları", description: "Sadece hafta sonları uygunum" }
];

const interests = [
  { id: "AI", label: "Yapay Zeka", emoji: "🤖" },
  { id: "Web Development", label: "Web Geliştirme", emoji: "💻" },
  { id: "Mobile", label: "Mobil Geliştirme", emoji: "📱" },
  { id: "Data Science", label: "Veri Bilimi", emoji: "📊" },
  { id: "UI/UX", label: "UI/UX Tasarım", emoji: "🎨" }
];

export default function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    watch,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    mode: "onChange",
    defaultValues: {
      personal: { firstName: "", lastName: "", birthYear: undefined, phoneNumber: "" },
      experience: { level: undefined, interest: [] },
      goals: { goal: "", availability: undefined },
    },
  });

  const stepFields: FieldPath<OnboardingFormData>[][] = [
    ["personal.firstName", "personal.lastName", "personal.birthYear", "personal.phoneNumber"],
    ["experience.level", "experience.interest"],
    ["goals.goal", "goals.availability"],
  ];

  const onNext = async () => {
    const valid = await trigger(stepFields[step]);
    if (!valid) return;
    setStep((s) => s + 1);
  };

  const onBack = () => setStep((s) => s - 1);

  const onFinalSubmit = async (data: OnboardingFormData) => {
    try {
      setIsSubmitting(true);
      await saveOnboarding(data);
    } catch (err) {
      console.error("Onboarding kaydı başarısız:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Hoş Geldiniz!</h1>
          <p className="text-gray-600">Sizin için en uygun mentor eşleştirmesi yapabilmemiz için birkaç soruyu yanıtlayın</p>
        </div>

        {/* Steps Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((s, index) => (
              <div key={s.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                  index <= step 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-400'
                }`}>
                  {index < step ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <s.icon className="w-5 h-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-20 h-1 mx-4 rounded transition-all duration-300 ${
                    index < step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
          <form onSubmit={handleSubmit(onFinalSubmit)} className="space-y-6">
            {/* Step Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <currentStep.icon className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentStep.title}</h2>
              <p className="text-gray-600">{currentStep.description}</p>
            </div>

            {/* Step 0: Personal Information */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="personal.firstName" className="block text-sm font-medium text-gray-700">
                      Adınız *
                    </label>
                    <Input 
                      id="personal.firstName" 
                      {...register("personal.firstName")} 
                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Adınızı girin"
                    />
                    {errors.personal?.firstName && (
                      <p className="text-red-500 text-sm flex items-center gap-1">
                        {errors.personal.firstName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="personal.lastName" className="block text-sm font-medium text-gray-700">
                      Soyadınız *
                    </label>
                    <Input 
                      id="personal.lastName" 
                      {...register("personal.lastName")} 
                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Soyadınızı girin"
                    />
                    {errors.personal?.lastName && (
                      <p className="text-red-500 text-sm">{errors.personal.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="personal.birthYear" className="block text-sm font-medium text-gray-700">
                      Doğum Yılı *
                    </label>
                    <Input 
                      id="personal.birthYear" 
                      type="number" 
                      {...register("personal.birthYear", { valueAsNumber: true })} 
                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Örn: 1995"
                    />
                    {errors.personal?.birthYear && (
                      <p className="text-red-500 text-sm">{errors.personal.birthYear.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="personal.phoneNumber" className="block text-sm font-medium text-gray-700">
                      Telefon Numaranız *
                    </label>
                    <Input 
                      id="personal.phoneNumber" 
                      {...register("personal.phoneNumber")} 
                      className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Örn: +90 555 123 45 67"
                    />
                    {errors.personal?.phoneNumber && (
                      <p className="text-red-500 text-sm">{errors.personal.phoneNumber.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Experience */}
            {step === 1 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    Deneyim Seviyeniz *
                  </label>
                  <div className="grid gap-4">
                    {experienceLevels.map((level) => (
                      <label key={level.value} className="relative">
                        <input
                          type="radio"
                          value={level.value}
                          {...register("experience.level")}
                          className="sr-only peer"
                        />
                        <div className="p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all duration-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{level.label}</h3>
                              <p className="text-sm text-gray-600">{level.description}</p>
                            </div>
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full peer-checked:border-blue-500 peer-checked:bg-blue-500 peer-checked:after:content-[''] peer-checked:after:w-2 peer-checked:after:h-2 peer-checked:after:bg-white peer-checked:after:rounded-full peer-checked:after:absolute peer-checked:after:top-1/2 peer-checked:after:left-1/2 peer-checked:after:-translate-x-1/2 peer-checked:after:-translate-y-1/2 relative"></div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.experience?.level && (
                    <p className="text-red-500 text-sm">{errors.experience.level.message}</p>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    İlgi Alanlarınız * <span className="text-sm text-gray-500">(Birden fazla seçebilirsiniz)</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {interests.map((interest) => (
                      <label key={interest.id} className="relative">
                        <input
                          type="checkbox"
                          value={interest.id}
                          {...register("experience.interest")}
                          className="sr-only peer"
                        />
                        <div className="p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all duration-200">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{interest.emoji}</span>
                            <span className="font-medium text-gray-900">{interest.label}</span>
                            <div className="ml-auto w-5 h-5 border-2 border-gray-300 rounded peer-checked:border-blue-500 peer-checked:bg-blue-500 peer-checked:after:content-['✓'] peer-checked:after:text-white peer-checked:after:text-xs peer-checked:after:flex peer-checked:after:items-center peer-checked:after:justify-center peer-checked:after:w-full peer-checked:after:h-full"></div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.experience?.interest && (
                    <p className="text-red-500 text-sm">{(errors.experience.interest as any).message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Goals */}
            {step === 2 && (
              <div className="space-y-8">
                <div className="space-y-2">
                  <label htmlFor="goals.goal" className="block text-sm font-medium text-gray-700">
                    Öğrenme hedefiniz nedir? *
                  </label>
                  <textarea
                    id="goals.goal"
                    {...register("goals.goal")}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500 resize-none"
                    placeholder="Örn: Web geliştirme alanında kendimi geliştirmek ve profesyonel projelerde çalışabilecek seviyeye gelmek istiyorum..."
                  />
                  {errors.goals?.goal && (
                    <p className="text-red-500 text-sm">{errors.goals.goal.message}</p>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Uygunluğunuz *
                  </label>
                  <div className="grid gap-4">
                    {availabilityOptions.map((option) => (
                      <label key={option.value} className="relative">
                        <input
                          type="radio"
                          value={option.value}
                          {...register("goals.availability")}
                          className="sr-only peer"
                        />
                        <div className="p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all duration-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{option.label}</h3>
                              <p className="text-sm text-gray-600">{option.description}</p>
                            </div>
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full peer-checked:border-blue-500 peer-checked:bg-blue-500 peer-checked:after:content-[''] peer-checked:after:w-2 peer-checked:after:h-2 peer-checked:after:bg-white peer-checked:after:rounded-full peer-checked:after:absolute peer-checked:after:top-1/2 peer-checked:after:left-1/2 peer-checked:after:-translate-x-1/2 peer-checked:after:-translate-y-1/2 relative"></div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {errors.goals?.availability && (
                    <p className="text-red-500 text-sm">{errors.goals.availability.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-8 border-t border-gray-200">
              {step > 0 ? (
                <Button 
                  type="button" 
                  onClick={onBack}
                  variant="outline"
                  className="h-12 px-6 border-gray-300 hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Geri
                </Button>
              ) : (
                <div />
              )}
              
              {step < steps.length - 1 ? (
                <Button 
                  type="button" 
                  onClick={onNext}
                  className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  İleri
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="h-12 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Tamamla
                    </>
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