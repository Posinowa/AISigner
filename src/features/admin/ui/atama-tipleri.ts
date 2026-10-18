/** Admin atama listesinin satır verisi (sunucu `assignment-progress.ts` ile elle eşleşir). */
export type StudentAssignmentProgress = {
  assignmentId: string;
  studentId: string;
  studentName: string;
  // #332/#367: Takım atamasında tek bir öğrenci yok.
  studentEmail: string | null;
  experienceLevel: string | null;
  teamId: string | null;
  teamMembers: { name: string; role: string }[];
  // #195: M:N — atanmış mentorlar (0..n).
  mentors: { id: string; name: string }[];
  projectTemplateId: string;
  projectTitle: string;
  projectDifficulty: string;
  assignmentStatus: string;
  githubRepoUrl: string | null;
  githubStatus: string;
  provisionedAt: Date | null;
  /**
   * #483: kurulum yarıda kalmış (süreç yeniden başlamış). Eşik SUNUCUDA
   * hesaplanıyor — burada tekrar yazmak kilitteki eşikle ayrışırdı.
   *
   * ⚠️ Bu tip sunucudaki `StudentAssignmentProgress`in ELLE TUTULAN
   * kopyası. Alanı orada ekleyip burada unutmak derleme hatası verdi;
   * ikisini bir arada tutan tek şey şu an tsc.
   */
  kurulumTakildi: boolean;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  /** #432: Durakladıysa "10 gündür hareket yok", aksi halde null. */
  duraklamaMetni: string | null;
  lastActivity: {
    title: string;
    updatedAt: Date;
  } | null;
  roadmapId: string | null;
  roadmapStatus: string | null;
};
