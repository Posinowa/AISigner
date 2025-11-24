"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, OnboardingFormData } from "@/features/student/models/onboarding";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveOnboarding } from "@/features/student/server/onboarding";

import type { FieldPath } from "react-hook-form";
const steps = ["Kişisel Bilgiler", "Deneyim", "Hedefler"];

export default function OnboardingForm() {
  const [step, setStep] = useState(0);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    mode: "onChange",
    defaultValues: {
      personal: { firstName: "", lastName: "", birthYear: undefined, phoneNumber: "" },
      experience: { level: undefined , interest: [] },
      goals: { goal: "", availability: undefined },
    },
  });



// stepFields için
const stepFields: FieldPath<OnboardingFormData>[][] = [
  ["personal.firstName", "personal.lastName", "personal.birthYear", "personal.phoneNumber"],
  ["experience.level", "experience.interest"],
  ["goals.goal", "goals.availability"],
];

// onNext
const onNext = async () => {
  const valid = await trigger(stepFields[step]);
  if (!valid) return;
  setStep((s) => s + 1);
};


  const onBack = () => setStep((s) => s - 1);

  const onFinalSubmit = async (data: OnboardingFormData) => {
    try {
      await saveOnboarding(data);
    } catch (err) {
      console.error("Onboarding kaydı başarısız:", err);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFinalSubmit)} className="space-y-6 max-w-md mx-auto p-6 bg-white rounded-xl shadow-md">
      <Progress value={((step + 1) / steps.length) * 100} />

      {/* Step 0: Personal */}
      {step === 0 && (
        <>
          <div className="space-y-2">
            <label htmlFor="personal.firstName">Adınız</label>
            <Input id="personal.firstName" {...register("personal.firstName")} />
            {errors.personal?.firstName && <p className="text-red-500 text-sm">{errors.personal.firstName.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="personal.lastName">Soyadınız</label>
            <Input id="personal.lastName" {...register("personal.lastName")} />
            {errors.personal?.lastName && <p className="text-red-500 text-sm">{errors.personal.lastName.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="personal.birthYear">Doğum Yılı</label>
            <Input id="personal.birthYear" type="number" {...register("personal.birthYear", { valueAsNumber: true })} />
            {errors.personal?.birthYear && <p className="text-red-500 text-sm">{errors.personal.birthYear.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="personal.phoneNumber">Telefon Numaranız</label>
            <Input id="personal.phoneNumber" {...register("personal.phoneNumber")} />
            {errors.personal?.phoneNumber && <p className="text-red-500 text-sm">{errors.personal.phoneNumber.message}</p>}
          </div>
        </>
      )}

      {/* Step 1: Experience */}
      {step === 1 && (
        <>
          <div className="space-y-2">S
            <label htmlFor="experience.level">Seviye</label>
            <select {...register("experience.level")} id="experience.level" className="border p-2 rounded w-full">
              <option value="">Seçiniz</option>
              <option value="beginner">Yeni Başlayan</option>
              <option value="intermediate">Orta Seviye</option>
              <option value="advanced">İleri Seviye</option>
            </select>
            {errors.experience?.level && <p className="text-red-500 text-sm">{errors.experience.level.message}</p>}
          </div>

          <div className="mt-4 space-y-2">
            <label>İlgi Alanların</label>
            <div className="space-y-2">
              {["AI", "Web Development", "Mobile", "Data Science", "UI/UX"].map((i) => (
                <label key={i} className="flex items-center space-x-2">
                  <input type="checkbox" value={i} {...register("experience.interest")} />
                  <span>{i}</span>
                </label>
              ))}
            </div>
            {errors.experience?.interest && <p className="text-red-500 text-sm">{(errors.experience.interest as any).message}</p>}
          </div>
        </>
      )}

      {/* Step 2: Goals */}
      {step === 2 && (
        <>
          <div className="space-y-2">
            <label htmlFor="goals.goal">Öğrenme hedefiniz nedir?</label>
            <Input id="goals.goal" {...register("goals.goal")} />
            {errors.goals?.goal && <p className="text-red-500 text-sm">{errors.goals.goal.message}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="goals.availability">Uygunluk</label>
            <select {...register("goals.availability")} id="goals.availability" className="border p-2 rounded w-full">
              <option value="">Uygunluk seçin</option>
              <option value="full-time">Tam zamanlı</option>
              <option value="part-time">Yarı zamanlı</option>
              <option value="weekends">Hafta sonları</option>
            </select>
            {errors.goals?.availability && <p className="text-red-500 text-sm">{errors.goals.availability.message}</p>}
          </div>
        </>
      )}

      <div className="flex justify-between pt-4">
        {step > 0 && <Button type="button" onClick={onBack}>Geri</Button>}
        {step < steps.length - 1 ? (
          <Button type="button" onClick={onNext}>İleri</Button>
        ) : (
          <Button type="submit">Gönder</Button>
        )}
      </div>
    </form>
  );
}