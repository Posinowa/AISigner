// #55: OnboardingForm 3 ayrı alan gösterir (knownTech/futureGoal/learningStyle)
// ama backend şeması (StudentProfile.goals) tek bir string saklar. Bu modül
// derleme (compile) ve geri ayrıştırma (parse) mantığını tek yerde tutar —
// format ikisi arasında senkron kalsın diye OnboardingForm de bunu kullanır.

export type CompiledGoalsFields = {
  knownTech: string;
  futureGoal: string;
  learningStyle: string;
};

const KNOWN_TECH_LABEL = "MEVCUT BİLGİ BİRİKİMİ";
const FUTURE_GOAL_LABEL = "GELECEK VİZYONU VE HEDEFLER";
const LEARNING_STYLE_LABEL = "ÖĞRENME VE ÇALIŞMA STİLİ";

/** Üç ayrı alanı backend'in beklediği tek `goal` string'ine derler. */
export function compileGoals(fields: CompiledGoalsFields): string {
  return `
[${KNOWN_TECH_LABEL}]: ${fields.knownTech}
[${FUTURE_GOAL_LABEL}]: ${fields.futureGoal}
[${LEARNING_STYLE_LABEL}]: ${fields.learningStyle}
  `.trim();
}

const PARSE_PATTERN = new RegExp(
  `\\[${KNOWN_TECH_LABEL}\\]:\\s*([\\s\\S]*?)\\s*` +
    `\\[${FUTURE_GOAL_LABEL}\\]:\\s*([\\s\\S]*?)\\s*` +
    `\\[${LEARNING_STYLE_LABEL}\\]:\\s*([\\s\\S]*)$`,
);

/**
 * `compileGoals` ile üretilmiş string'i üç alana geri ayrıştırır. Format
 * eşleşmezse (eski/elle düzenlenmiş veri) ham metni `futureGoal`'e koyar —
 * hiçbir şey göstermemek yerine en azından tek bir alanda geri getirir.
 */
export function parseCompiledGoals(goals: string | null | undefined): CompiledGoalsFields {
  const raw = (goals ?? "").trim();
  if (!raw) {
    return { knownTech: "", futureGoal: "", learningStyle: "" };
  }

  const match = raw.match(PARSE_PATTERN);
  if (!match) {
    return { knownTech: "", futureGoal: raw, learningStyle: "" };
  }

  return {
    knownTech: match[1].trim(),
    futureGoal: match[2].trim(),
    learningStyle: match[3].trim(),
  };
}
