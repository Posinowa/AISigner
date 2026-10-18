import type { KodIncelemesiDurumu } from "@/features/kvkk/kod-incelemesi-durumu";
import type { CalismaAlaniTalebi } from "@/features/workspace-requests/ui/CalismaAlaniBolumu";
import type { ProfileAnalysisData } from "@/features/ai/ui/ProfileAnalysisCard";
import type { ProjectTemplate } from "@/features/mentors/ui/ProjeAtamaModali";

export type RoadmapStep = {
  id: string;
  order: number;
  title: string;
  status: string;
};

export type Roadmap = {
  id: string;
  title: string;
  status: string;
  steps: RoadmapStep[];
};

export type StudentDetail = {
  /**
   * #394: Atama kimliği -> AI kod incelemesi durumu.
   *
   * Kural (takımda herkesin güncel rızası) değişmiyor; eksik olan
   * sessizliğiydi — engelleme hiç kimseye söylenmiyordu.
   */
  kodIncelemesi?: Record<string, KodIncelemesiDurumu>;
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  studentProfile: {
    id: string;
    birthYear: number | null;
    experienceLevel: string;
    interests: string[];
    goals: string | null;
    availability: string | null;
    assignedProjects: {
      id: string;
      status: string;
      projectTemplate: ProjectTemplate;
      createdAt: string;
      roadmap?: Roadmap | null; // 🚀 SPRINT 3: Roadmap eklendi
      // #349: Çalışma alanının durumu ve mentörün son talebi.
      githubStatus: string;
      githubRepoUrl: string | null;
      workspaceRequests?: CalismaAlaniTalebi[];
      /**
       * #442: Doluysa bu satır bir TAKIM projesidir.
       *
       * ⚠️ Öncesi takım projeleri bu listeye HİÇ girmiyordu (takımda
       * `studentProfileId` NULL, #332) ve mentör takımda aktif çalışan bir
       * stajyeri "projesi yok" olarak görüyordu.
       */
      takim?: {
        id: string;
        name: string;
        members: {
          role: string;
          studentProfile: {
            user: { id: string; name: string | null; lastName: string | null; email: string };
          };
        }[];
      } | null;
    }[];
    // #48: Detaylı AI profil analizi (yoksa null — henüz üretilmemiş).
    profileAnalysis: ProfileAnalysisData | null;
  } | null;
};
