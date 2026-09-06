/**
 * #115: profile-setup prefill eşlemesi — sayfadan gelen `initial` verisinin
 * OnboardingForm'un defaultValues şekline dönüştürülmesi.
 *
 * Bu mantık önceden OnboardingForm içinde inline'dı ve kombinasyonları
 * (profil var/yok, compiled goals round-trip, experienceLevel map) test
 * edilemiyordu. Saf fonksiyon olarak buradan hem form hem testler kullanır.
 */
import { parseCompiledGoals } from "./compiledGoals";
import { experienceLevelToFormValue } from "@/lib/experience-level";

export type OnboardingInitialValues = {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  // #55: Mevcut StudentProfile alanları — profile-setup'a dönen öğrenci için prefill.
  birthYear?: number;
  experienceLevel?: string;
  interests?: string[];
  goals?: string;
  availability?: string;
  // #289: Genişletilen başvuru soruları.
  city?: string;
  gitLevel?: string;
  weeklyHours?: number;
  school?: string;
  department?: string;
  classYear?: string;
  englishLevel?: string;
};

export function buildOnboardingDefaultValues(initial?: OnboardingInitialValues) {
  // #55: Mevcut StudentProfile.goals tek bir derlenmiş string — form'un üç ayrı
  // alanına (knownTech/futureGoal/learningStyle) geri ayrıştırılır.
  const parsedGoals = parseCompiledGoals(initial?.goals);

  return {
    personal: {
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      birthYear: initial?.birthYear ?? undefined,
      phoneNumber: initial?.phoneNumber ?? "",
      city: initial?.city ?? "",
    },
    education: {
      school: initial?.school ?? "",
      department: initial?.department ?? "",
      classYear: initial?.classYear ?? "",
      englishLevel: initial?.englishLevel ?? "",
    },
    experience: {
      level: initial?.experienceLevel ? experienceLevelToFormValue(initial.experienceLevel) : "",
      gitLevel: initial?.gitLevel ?? "",
      knownTech: parsedGoals.knownTech,
    },
    vision: {
      interest: initial?.interests ?? [],
      futureGoal: parsedGoals.futureGoal,
    },
    workingStyle: {
      learningStyle: parsedGoals.learningStyle,
      // #289: Uygunluk kovaları yerine saat. Eski kayıtta saat yok —
      // undefined bırakılıyor ki sayı alanı 0 ile dolmasın.
      weeklyHours: initial?.weeklyHours,
    },
  };
}

/**
 * #83/#115: "Ek Sorular" adımı gösterilmeli mi?
 * Gerçek boş (admin hiç soru tanımlamamış) → adım gizlenir.
 * Yükleme başarısız → adım GÖSTERİLİR ki kullanıcı hatayı görsün
 * (adımın "hiç soru yokmuş" gibi sessizce kaybolması yerine).
 */
export function shouldShowSurveyStep(questionCount: number, loadFailed: boolean): boolean {
  return questionCount > 0 || loadFailed;
}
