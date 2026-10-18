"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { EnhancedFormData } from "@/features/student/ui/OnboardingForm";
import type { SurveyQuestionView } from "@/features/survey/answers";
import { Input } from "@/components/ui/input";
import { AlertCircle, Clock } from "lucide-react";
import { DENEYIM_SEVIYELERI, GIT_SEVIYELERI, HAFTALIK_SAAT_EN_AZ, HAFTALIK_SAAT_EN_COK, ILGI_ALANLARI, INGILIZCE_SEVIYELERI, SINIFLAR } from "@/features/student/models/secenekler";

export type OnboardingAdimIcerigiProps = {
  step: number;
  register: UseFormRegister<EnhancedFormData>;
  errors: FieldErrors<EnhancedFormData>;
  surveyQuestions: SurveyQuestionView[];
  answers: Record<string, string>;
  setAnswers: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  stepAttempted: boolean[];
  hasSurvey: boolean;
  surveyLoadFailed: boolean;
  sonAdimIndex: number;
};

/** Stajyer onboarding formunun adım içerikleri (adım göstergesi ve gezinme hariç). */
export function OnboardingAdimIcerigi({
  step,
  register,
  errors,
  surveyQuestions,
  answers,
  setAnswers,
  stepAttempted,
  hasSurvey,
  surveyLoadFailed,
  sonAdimIndex,
}: OnboardingAdimIcerigiProps) {
  return (
    <>
        {/* ADIM 0: KİŞİSEL BİLGİLER */}
        {step === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="ob-firstName" className="block text-sm font-semibold text-gray-700">Adınız</label>
                <Input id="ob-firstName" {...register("personal.firstName")} className="h-12 bg-gray-50" placeholder="Örn: Ali" />
                {stepAttempted[0] && errors.personal?.firstName && <p className="text-red-500 text-xs">{errors.personal.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="ob-lastName" className="block text-sm font-semibold text-gray-700">Soyadınız</label>
                <Input id="ob-lastName" {...register("personal.lastName")} className="h-12 bg-gray-50" placeholder="Örn: Yılmaz" />
                {stepAttempted[0] && errors.personal?.lastName && <p className="text-red-500 text-xs">{errors.personal.lastName.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="ob-birthYear" className="block text-sm font-semibold text-gray-700">Doğum Yılı</label>
                <Input id="ob-birthYear" type="number" {...register("personal.birthYear", { valueAsNumber: true })} className="h-12 bg-gray-50" placeholder="Örn: 2002" />
                {stepAttempted[0] && errors.personal?.birthYear && <p className="text-red-500 text-xs">{errors.personal.birthYear.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="ob-phone" className="block text-sm font-semibold text-gray-700">Telefon Numaranız</label>
                <Input id="ob-phone" {...register("personal.phoneNumber")} className="h-12 bg-gray-50" placeholder="Örn: 0555 123 45 67" />
                {stepAttempted[0] && errors.personal?.phoneNumber && <p className="text-red-500 text-xs">{errors.personal.phoneNumber.message}</p>}
              </div>

              {/* #289: Açılış sayfası "81 ilde eşleşme" hedefini anlatıyor
                  ama il hiç sorulmuyordu; iddia ölçülemiyordu. */}
              <div className="space-y-2">
                <label htmlFor="ob-city" className="block text-sm font-semibold text-gray-700">Yaşadığın il</label>
                <Input id="ob-city" {...register("personal.city")} className="h-12 bg-gray-50" placeholder="Örn: Samsun" />
                {stepAttempted[0] && errors.personal?.city && <p className="text-red-500 text-xs">{errors.personal.city.message}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ADIM 1: EĞİTİM (#289) */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="ob-school" className="block text-sm font-semibold text-gray-700">Okulun</label>
                <Input id="ob-school" {...register("education.school")} className="h-12 bg-gray-50" placeholder="Örn: Ondokuz Mayıs Üniversitesi" />
                {stepAttempted[1] && errors.education?.school && <p className="text-red-500 text-xs">{errors.education.school.message}</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="ob-department" className="block text-sm font-semibold text-gray-700">Bölümün</label>
                <Input id="ob-department" {...register("education.department")} className="h-12 bg-gray-50" placeholder="Örn: Bilgisayar Mühendisliği" />
                {stepAttempted[1] && errors.education?.department && <p className="text-red-500 text-xs">{errors.education.department.message}</p>}
              </div>
            </div>

            <div className="space-y-3">
              <label htmlFor="ob-classYear" className="block text-sm font-semibold text-gray-700">Sınıfın</label>
              <select id="ob-classYear" {...register("education.classYear")} className="h-12 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-sm">
                <option value="">Seçiniz</option>
                {SINIFLAR.map((sn) => (
                  <option key={sn.deger} value={sn.deger}>{sn.etiket}</option>
                ))}
              </select>
              {stepAttempted[1] && errors.education?.classYear && <p className="text-red-500 text-xs">{errors.education.classYear.message}</p>}
            </div>

            <div className="space-y-4">
              {/* #289: Doküman okuma kabiliyeti yol haritasının kaynak
                  seçimini doğrudan etkiliyor. */}
              <label className="block text-sm font-semibold text-gray-700">İngilizce seviyen</label>
              <div className="grid gap-3 md:grid-cols-2">
                {INGILIZCE_SEVIYELERI.map((sv) => (
                  <label key={sv.deger} className="relative">
                    <input type="radio" value={sv.deger} {...register("education.englishLevel")} className="sr-only peer" />
                    <div className="p-4 border-2 border-gray-100 rounded-xl cursor-pointer hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50 transition-all">
                      <span className="font-medium text-sm text-gray-800">{sv.etiket}</span>
                    </div>
                  </label>
                ))}
              </div>
              {stepAttempted[1] && errors.education?.englishLevel && <p className="text-red-500 text-xs">{errors.education.englishLevel.message}</p>}
            </div>
          </div>
        )}

        {/* ADIM 2: DENEYİM VE ALTYAPI */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Deneyim Seviyeniz
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                {DENEYIM_SEVIYELERI.map((level) => (
                  <label key={level.deger} className="relative">
                    <input type="radio" value={level.deger} {...register("experience.level")} className="sr-only peer" />
                    <div className="p-5 h-full border-2 border-gray-100 rounded-xl cursor-pointer hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50 transition-all text-center">
                      <h3 className="font-bold text-gray-900 mb-2">{level.etiket}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{level.aciklama}</p>
                    </div>
                  </label>
                ))}
              </div>
              {stepAttempted[2] && errors.experience?.level && <p className="text-red-500 text-xs">{errors.experience.level.message}</p>}
            </div>

            <div className="space-y-4">
              {/* #289'un en büyük boşluğu: platformun tüm iş akışı repo + issue +
                  PR üzerinden yürüyor ama bu hiç sorulmuyordu. Mentör, stajyerin
                  PR açmayı bilip bilmediğini bilmeden yol haritası çiziyordu. */}
              <label className="block text-sm font-semibold text-gray-700">
                Git / GitHub deneyimin
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Projeler GitHub üzerinden yürüyor; bilmiyorsan ilk adımların bunu öğretecek şekilde planlanır.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {GIT_SEVIYELERI.map((g) => (
                  <label key={g.deger} className="relative">
                    <input type="radio" value={g.deger} {...register("experience.gitLevel")} className="sr-only peer" />
                    <div className="p-4 h-full border-2 border-gray-100 rounded-xl cursor-pointer hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50 transition-all">
                      <h3 className="font-semibold text-sm text-gray-900">{g.etiket}</h3>
                      <p className="text-xs text-gray-500 mt-1">{g.aciklama}</p>
                    </div>
                  </label>
                ))}
              </div>
              {stepAttempted[2] && errors.experience?.gitLevel && <p className="text-red-500 text-xs">{errors.experience.gitLevel.message}</p>}
            </div>

            <div className="space-y-3">
              <label htmlFor="ob-knownTech" className="block text-sm font-semibold text-gray-700">
                Şu ana kadar neler öğrendiniz / denediniz? (AI için çok önemli 🤖)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {`Lütfen bildiğiniz dilleri, araçları veya kendi başınıza denediğiniz şeyleri dürüstçe yazın. (Örn: "Üniversitede C++ gördüm, HTML/CSS ile basit bir site yaptım ama JavaScript'te zorlanıyorum.")`}
              </p>
              <textarea
                id="ob-knownTech"
                {...register("experience.knownTech")}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-ring outline-none resize-none transition-all"
                placeholder="Bildiğiniz teknolojileri ve mevcut durumunuzu anlatın..."
              />
              {stepAttempted[2] && errors.experience?.knownTech && <p className="text-red-500 text-xs">{errors.experience.knownTech.message}</p>}
            </div>
          </div>
        )}

        {/* ADIM 3: İLGİ ALANLARI VE VİZYON */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">
                Hangi alanlara ilgi duyuyorsunuz? (Birden fazla seçilebilir)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ILGI_ALANLARI.map((interest) => (
                  <label key={interest.deger} className="relative">
                    <input type="checkbox" value={interest.deger} {...register("vision.interest")} className="sr-only peer" />
                    <div className="p-3 border-2 border-gray-100 rounded-xl cursor-pointer hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50 transition-all flex items-center gap-2">
                      <span className="text-xl">{interest.emoji}</span>
                      <span className="font-medium text-sm text-gray-800">{interest.etiket}</span>
                    </div>
                  </label>
                ))}
              </div>
              {stepAttempted[3] && errors.vision?.interest && <p className="text-red-500 text-xs">{errors.vision.interest.message}</p>}
            </div>

            <div className="space-y-3">
              <label htmlFor="ob-futureGoal" className="block text-sm font-semibold text-gray-700">
                Gelecekte ne tür projeler yapmak istiyorsunuz?
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {`Önümüzdeki 1 yıl içinde neleri başarmak istersiniz? (Örn: "Kendi e-ticaret sitemi kurmak istiyorum" veya "Bir yapay zeka modelini mobil uygulamaya entegre etmek istiyorum.")`}
              </p>
              <textarea
                id="ob-futureGoal"
                {...register("vision.futureGoal")}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-ring outline-none resize-none transition-all"
                placeholder="Hayalinizdeki projeleri ve hedeflerinizi detaylandırın..."
              />
              {stepAttempted[3] && errors.vision?.futureGoal && <p className="text-red-500 text-xs">{errors.vision.futureGoal.message}</p>}
            </div>
          </div>
        )}

        {/* ADIM 4: ÇALIŞMA TARZI VE ZAMAN */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-3">
              <label htmlFor="ob-learningStyle" className="block text-sm font-semibold text-gray-700">
                Sizin için en iyi öğrenme yöntemi nedir?
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {`Size bir proje verildiğinde nasıl ilerlemeyi seversiniz? (Örn: "Adım adım, doküman okuyarak ilerlemeyi severim" veya "Hata yapa yapa, direkt kod yazarak öğrenmek isterim.")`}
              </p>
              <textarea
                id="ob-learningStyle"
                {...register("workingStyle.learningStyle")}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-ring outline-none resize-none transition-all"
                placeholder="Nasıl bir çalışma tarzı sizi daha verimli yapar?"
              />
              {stepAttempted[4] && errors.workingStyle?.learningStyle && <p className="text-red-500 text-xs">{errors.workingStyle.learningStyle.message}</p>}
            </div>

            <div className="space-y-3">
              {/* #289: "Tam zamanlı / yarı zamanlı" kişiden kişiye değişiyordu.
                  Saat, mentörün yol haritasını planlayabileceği bir ölçü. */}
              <label htmlFor="ob-weeklyHours" className="block text-sm font-semibold text-gray-700">
                Haftada kaç saat ayırabilirsiniz?
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Dürüst bir sayı yazın — yol haritanız buna göre planlanacak.
              </p>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                <Input
                  id="ob-weeklyHours"
                  type="number"
                  min={HAFTALIK_SAAT_EN_AZ}
                  max={HAFTALIK_SAAT_EN_COK}
                  {...register("workingStyle.weeklyHours", { valueAsNumber: true })}
                  className="h-12 bg-gray-50 max-w-[160px]"
                  placeholder="Örn: 12"
                />
                <span className="text-sm text-gray-500">saat / hafta</span>
              </div>
              {stepAttempted[4] && errors.workingStyle?.weeklyHours && <p className="text-red-500 text-xs">{errors.workingStyle.weeklyHours.message}</p>}
            </div>
          </div>
        )}

        {/* ADIM 4 (opsiyonel): ADMIN ANKET SORULARI */}
        {hasSurvey && step === sonAdimIndex && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* #83: Sorular yüklenemedi (fetch hatası) — "hiç soru yok" ile
                karıştırılmasın diye açık bir uyarı gösterilir. */}
            {surveyLoadFailed && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Ek sorular şu anda yüklenemedi. Bu adımı boş bırakarak kayıt işlemine devam edebilirsiniz;
                  sorunu daha sonra profilinizden yanıtlayabilirsiniz.
                </p>
              </div>
            )}
            {surveyQuestions.map((q) => (
              <div key={q.id} className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">{q.question}</label>
                {q.options.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {q.options.map((opt) => (
                      <label key={opt} className="relative">
                        <input
                          type="radio"
                          name={`survey-${q.id}`}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          className="sr-only peer"
                        />
                        <div className="p-4 border-2 border-gray-100 rounded-xl cursor-pointer hover:border-blue-200 peer-checked:border-blue-600 peer-checked:bg-blue-50/50 transition-all text-sm font-medium text-gray-800">
                          {opt}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-600 focus:ring-1 focus:ring-ring outline-none resize-none transition-all"
                    placeholder="Cevabınız..."
                  />
                )}
              </div>
            ))}
            {surveyQuestions.length > 0 && (
              <p className="text-xs text-gray-400">Bu sorular opsiyoneldir; boş bırakabilirsiniz.</p>
            )}
          </div>
        )}
    </>
  );
}
