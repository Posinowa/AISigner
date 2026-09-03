"use client";

import { taslakMi, TASLAK_ROZETI, TASLAK_SONUCU } from "@/features/roadmap/taslak";
import { KodIncelemesiDurumuRozeti } from "@/features/kvkk/ui/KodIncelemesiDurumu";
import type { KodIncelemesiDurumu } from "@/features/kvkk/kod-incelemesi-durumu";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, User, Clock, BookOpen, Plus, CheckCircle, AlertCircle, Trash2, Sparkles, Map, Github, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { experienceLevelLabel } from "@/lib/experience-level";
import { ProfileAnalysisCard, type ProfileAnalysisData } from "@/features/ai/ui/ProfileAnalysisCard";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useModalA11y } from "@/components/ui/useModalA11y";
import { stripMarkdown } from "@/lib/markdown-preview";
import {
  CalismaAlaniBolumu,
  type CalismaAlaniTalebi,
} from "@/features/workspace-requests/ui/CalismaAlaniBolumu";

type ProjectTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
  githubRepoUrl?: string | null;
};

type AIRecommendation = {
  projectId: string;
  matchScore: number;
  reason: string;
};

// 🚀 SPRINT 3: Roadmap tipleri eklendi
type RoadmapStep = {
  id: string;
  order: number;
  title: string;
  status: string;
};

type Roadmap = {
  id: string;
  title: string;
  status: string;
  steps: RoadmapStep[];
};

type StudentDetail = {
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
    }[];
    // #48: Detaylı AI profil analizi (yoksa null — henüz üretilmemiş).
    profileAnalysis: ProfileAnalysisData | null;
  } | null;
};

const statusConfig = {
  PENDING: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  COMPLETED: { label: "Tamamlandı", color: "bg-green-100 text-green-800", icon: CheckCircle }
};

const difficultyConfig = {
  EASY: { label: "Kolay", color: "bg-green-100 text-green-800" },
  MEDIUM: { label: "Orta", color: "bg-yellow-100 text-yellow-800" },
  HARD: { label: "Zor", color: "bg-red-100 text-red-800" }
};

export default function StudentDetailPage() {
  const confirm = useConfirm();
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params.studentId as string;
  const activeTab = searchParams.get("tab") || "profile";

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  // #159: İstek başarısız olduğunda "öğrenci yok" denmesin — ağ/sunucu hatası
  // ayrı bir durum olarak tutulur ve tekrar deneme sunulur.
  const [loadError, setLoadError] = useState(false);
  const [templatesError, setTemplatesError] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  // Modal a11y: Escape ile kapat + açılışta panele odak.
  const assignModalRef = useModalA11y(showAssignModal, () => setShowAssignModal(false));

  const [isAIThinking, setIsAIThinking] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // 🚀 SPRINT 3: Roadmap üretimi için yükleniyor state'i
  const [generatingRoadmapId, setGeneratingRoadmapId] = useState<string | null>(null);

  const loadStudentDetail = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/mentor/students/${studentId}`);
      if (!res.ok) {
        // #159: 404 gerçekten "bu öğrenci sana atanmamış"; diğer kodlar
        // (500, 503...) geçici hata — ikisi ekranda ayrı gösterilir.
        if (res.status === 404) {
          setStudent(null);
        } else {
          setLoadError(true);
        }
        return;
      }
      setStudent(await res.json());
    } catch (error) {
      console.error("Failed to load student detail:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const loadProjectTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(false);
    try {
      const res = await fetch("/api/admin/project-templates");
      if (!res.ok) {
        setTemplatesError(true);
        return;
      }
      setProjectTemplates(await res.json());
    } catch (error) {
      console.error("Failed to load project templates:", error);
      setTemplatesError(true);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudentDetail();
    if (activeTab === "assign") {
      loadProjectTemplates();
      setShowAssignModal(true);
    }
  }, [activeTab, loadStudentDetail, loadProjectTemplates]);

  async function handleAIRecommend() {
    if (!student?.studentProfile?.id) {
      setAiError("Öğrenci profili henüz yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
      return;
    }

    setIsAIThinking(true);
    setAiRecommendations([]);
    setAiError(null);

    try {
      const res = await fetch("/api/mentor/ai-recommend-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileId: student.studentProfile.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiRecommendations(data.recommendations || []);
      } else {
        const err = await res.json();
        const msg = typeof err.error === "string" ? err.error : JSON.stringify(err.error);
        setAiError(msg || "AI önerisi alınamadı.");
      }
    } catch (error) {
      console.error("AI Error:", error);
      setAiError("AI ile iletişim kurarken bir hata oluştu. Sunucu loglarını kontrol edin.");
    } finally {
      setIsAIThinking(false);
    }
  }

  async function assignProject(projectTemplateId: string) {
    if (!student?.studentProfile) return;

    try {
      setAssigningId(projectTemplateId);
      const res = await fetch("/api/mentor/assign-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentProfileId: student.studentProfile.id,
          projectTemplateId
        }),
      });

      if (res.ok) {
        await loadStudentDetail();
        setShowAssignModal(false);
        setAiRecommendations([]); 
        toast.success("Proje başarıyla atandı!");
      } else {
        const error = await res.json();
        toast.error(error.error || "Proje atama başarısız");
      }
    } catch (error) {
      console.error("Failed to assign project:", error);
      toast.error("Proje atama başarısız");
    } finally {
      setAssigningId(null);
    }
  }

  async function handleDeleteAssignment(assignedProjectId: string) {
    const ok = await confirm({
      title: "Proje atamasını kaldır",
      description: "Bu proje atamasını kaldırmak istediğinizden emin misiniz? Bağlı yol haritası da silinir.",
      confirmLabel: "Kaldır",
      danger: true,
    });
    if (!ok) return;

    async function doDelete(force: boolean) {
      const res = await fetch("/api/mentor/unassign-project", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedProjectId, force }),
      });
      return res;
    }

    try {
      let res = await doDelete(false);

      // Backend öğrenci ilerlemesi varsa 409 döner — ek onay iste
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error || "Bu projede öğrenci ilerlemesi var.";
        const confirmed = await confirm({
          title: "Öğrenci ilerlemesi var",
          description: `${msg}\n\nYine de silmek istediğinden emin misin? Tüm ilerleme ve yol haritası kaybolacak.`,
          confirmLabel: "Yine de sil",
          danger: true,
        });
        if (!confirmed) return;
        res = await doDelete(true);
      }

      if (res.ok) {
        await loadStudentDetail();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "Silme işlemi başarısız oldu.");
      }
    } catch (error) {
      console.error("Silme hatası:", error);
      toast.error("Bir hata oluştu.");
    }
  }

  // 🚀 SPRINT 3: YENİ FONKSİYON - AI Yol Haritası Üret
  /*
   * #423: Mentör üretimi yönlendirebiliyor.
   *
   * ⚠️ Metin sunucuda `veriBlogu` ile sarılıyor (#390) ve prompt'ta profil
   * analizinden ÖNCELİKLİ olduğu açıkça yazılı — ikisi çelişirse hangisinin
   * kazandığı modele bırakılmamış.
   */
  const [yonlendirmeler, setYonlendirmeler] = useState<Record<string, string>>({});

  async function handleGenerateRoadmap(assignedProjectId: string) {
    try {
      setGeneratingRoadmapId(assignedProjectId);
      const res = await fetch("/api/mentor/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedProjectId,
          yonlendirme: yonlendirmeler[assignedProjectId]?.trim() || undefined,
        }),
      });

      if (res.ok) {
        await loadStudentDetail(); // Harita üretilince listeyi yenile
        toast.success("AI Yol Haritası başarıyla oluşturuldu!");
      } else {
        const error = await res.json();
        toast.error(error.error || "Yol haritası oluşturulamadı.");
      }
    } catch (error) {
      console.error("Roadmap Error:", error);
      toast.error("AI ile iletişim kurarken bir hata oluştu.");
    } finally {
      setGeneratingRoadmapId(null);
    }
  }

  const getStudentName = () => {
    if (!student) return "";
    return [student.name, student.lastName].filter(Boolean).join(" ") || "İsimsiz Öğrenci";
  };

  const getAssignedProjectIds = () => {
    return student?.studentProfile?.assignedProjects?.map(p => p.projectTemplate.id) || [];
  };

  const sortedProjectTemplates = [...projectTemplates].sort((a, b) => {
    const recA = aiRecommendations.find(r => r.projectId === a.id);
    const recB = aiRecommendations.find(r => r.projectId === b.id);
    
    if (recA && !recB) return -1;
    if (!recA && recB) return 1;
    if (recA && recB) return recB.matchScore - recA.matchScore;
    return 0; 
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Öğrenci detayları yükleniyor...</span>
      </div>
    );
  }

  // #159: Ağ/sunucu hatası ile "öğrenci yok" ayrı ekranlar. Önceden istek
  // patladığında da "Öğrenci bulunamadı" yazıyordu ve mentörün sayfayı elle
  // yenilemekten başka çaresi yoktu.
  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Öğrenci bilgileri yüklenemedi
          </h3>
          <p className="text-slate-500 text-sm mb-5">
            Bağlantıda bir sorun oluştu. Lütfen tekrar deneyin.
          </p>
          <button
            onClick={loadStudentDetail}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Öğrenci bulunamadı</h3>
          <p className="text-gray-600 mb-4">Bu öğrenci size atanmamış olabilir.</p>
          <Link href="/mentor-dashboard" className="text-blue-600 hover:text-blue-800">
            ← Dashboard&apos;a dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Link href="/mentor-dashboard" className="mr-4 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getStudentName()}</h1>
          <p className="text-gray-600">{student.email}</p>
        </div>
      </div>

      {/* Profile Section */}
      {!student.studentProfile ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-medium text-yellow-800">Profil Tamamlanmamış</h3>
              <p className="text-yellow-700 mt-1">
                Bu öğrenci henüz profilini tamamlamamış. Proje atayabilmek için öğrencinin profilini doldurmasını bekleyin.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Profil Bilgileri
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Deneyim Seviyesi</label>
                  <p className="text-gray-900">{experienceLevelLabel(student.studentProfile.experienceLevel)}</p>
                </div>

                {student.studentProfile.birthYear && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Yaş</label>
                    <p className="text-gray-900">~{new Date().getFullYear() - student.studentProfile.birthYear}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">İlgi Alanları</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {student.studentProfile.interests.map((interest, index) => (
                      <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                {student.studentProfile.goals && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Hedefler</label>
                    <p className="text-gray-900 text-sm">{student.studentProfile.goals}</p>
                  </div>
                )}

                {student.studentProfile.availability && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Uygunluk</label>
                    <p className="text-gray-900 text-sm">{student.studentProfile.availability}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  loadProjectTemplates();
                  setShowAssignModal(true);
                }}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Proje Ata
              </button>
            </div>
          </div>

          {/* Projects Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                Atanmış Projeler ({student.studentProfile.assignedProjects.length})
              </h2>

              {student.studentProfile.assignedProjects.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Henüz proje atanmamış</p>
                  <button
                    onClick={() => {
                      loadProjectTemplates();
                      setShowAssignModal(true);
                    }}
                    className="mt-3 text-green-600 hover:text-green-800 font-medium"
                  >
                    İlk projeyi atayın
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {student.studentProfile.assignedProjects.map(project => {
                    const statusInfo = statusConfig[project.status as keyof typeof statusConfig];
                    const difficultyInfo = difficultyConfig[project.projectTemplate.difficulty as keyof typeof difficultyConfig];
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <div key={project.id} className="border rounded-lg p-5 relative group bg-white hover:shadow-md transition-all">
                        <button 
                         onClick={() => handleDeleteAssignment(project.id)}
                         className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10"
                         aria-label="Atamayı kaldır"
                         title="Atamayı Kaldır"
                          >
                           <Trash2 className="w-4 h-4" />
                        </button>
                      
                        <div className="flex justify-between items-start mb-2 pr-8">
                          <h3 className="font-semibold text-gray-900 text-lg">{project.projectTemplate.title}</h3>
                          <div className="flex gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3 inline mr-1" />
                              {statusInfo.label}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${difficultyInfo.color}`}>
                              {difficultyInfo.label}
                            </span>
                          </div>
                        </div>
                        
                        {/* #91: Markdown işaretleri soyulmuş temiz önizleme (kart clamp'li). */}
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {stripMarkdown(project.projectTemplate.description)}
                        </p>

                        {project.projectTemplate.githubRepoUrl && (
                          <a
                            href={project.projectTemplate.githubRepoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 mb-3 transition-colors"
                          >
                            <Github className="w-3.5 h-3.5" />
                            {project.projectTemplate.githubRepoUrl.replace(/^https:\/\/github\.com\//, "")}
                          </a>
                        )}

                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-wrap gap-1">
                            {project.projectTemplate.track.slice(0, 3).map((tag, index) => (
                              <span key={index} className="px-2 py-1 text-[11px] font-medium bg-gray-100 text-gray-600 rounded-md">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(project.createdAt).toLocaleDateString("tr-TR")}
                          </span>
                        </div>

                        {/* 🚀 SPRINT 3: YOL HARİTASI ALANI EKLENDİ */}
                        <div className="pt-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 -mx-5 -mb-5 p-4 rounded-b-lg">
                          {project.roadmap ? (
                            <div className="w-full">
                              <div className="flex items-center justify-between w-full">
                                <span className="text-sm font-medium text-gray-700 flex items-center">
                                  <Map className="w-4 h-4 mr-2 text-[#3e92cc]" />
                                  {/* #405: Taslak rota önceden "Hazır" diye
                                      etiketleniyordu — gerçeğin TERSİ. Stajyer
                                      hiçbir adımı göremİyorken mentöre iş bitmiş
                                      gibi görünüyordu. */}
                                  AI Rotası{" "}
                                  {taslakMi(project.roadmap.status) ? TASLAK_ROZETI : "Yayında"}{" "}
                                  ({project.roadmap.steps?.length || 0} Adım)
                                </span>
                                <Link
                                  href={`/mentor-dashboard/roadmap/${project.roadmap.id}`}
                                  className="text-sm font-semibold text-[#2f7cb0] hover:text-primary transition-colors"
                                >
                                  İncele ve Onayla →
                                </Link>
                              </div>
                              {taslakMi(project.roadmap.status) && (
                                <p className="mt-1.5 text-xs leading-relaxed text-amber-700">
                                  {TASLAK_SONUCU}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="w-full">
                              {/* #423: Mentör yönlendirmesi — isteğe bağlı. */}
                              <label
                                htmlFor={`yonlendirme-${project.id}`}
                                className="block text-xs font-medium text-gray-600"
                              >
                                Yönlendirme (isteğe bağlı)
                              </label>
                              <input
                                id={`yonlendirme-${project.id}`}
                                value={yonlendirmeler[project.id] ?? ""}
                                onChange={(e) =>
                                  setYonlendirmeler((ö) => ({ ...ö, [project.id]: e.target.value }))
                                }
                                maxLength={500}
                                placeholder="Örn: Testlere ağırlık versin, GitHub akışını da öğrensin."
                                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#3e92cc] focus:outline-none"
                              />
                              <p className="mt-1 text-[11px] text-gray-400">
                                Yazdığın istek, öğrencinin AI analizinden önceliklidir.
                              </p>

                            <div className="mt-3 flex items-center justify-between w-full">
                              <span className="text-sm text-gray-500">Öğrenci için rota çizilmemiş.</span>
                              <button
                                onClick={() => handleGenerateRoadmap(project.id)}
                                disabled={generatingRoadmapId === project.id}
                                className={`text-sm font-medium flex items-center transition-all px-3 py-1.5 rounded-md ${
                                  generatingRoadmapId === project.id 
                                    ? "bg-[#3e92cc]/15 text-[#3e92cc] cursor-wait" 
                                    : "bg-[#3e92cc]/10 text-[#2f7cb0] hover:bg-[#3e92cc]/20"
                                }`}
                              >
                                {generatingRoadmapId === project.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                                    Harita Çiziliyor...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4 mr-1.5" /> 
                                    Yol Haritası Üret
                                  </>
                                )}
                              </button>
                            </div>
                            </div>
                          )}
                        </div>

                        {/* #349: Çalışma alanı — mentör TALEP eder, admin onaylar. */}
                        <CalismaAlaniBolumu
                          assignedProjectId={project.id}
                          githubStatus={project.githubStatus}
                          githubRepoUrl={project.githubRepoUrl}
                          talep={project.workspaceRequests?.[0] ?? null}
                          yolHaritasiHazir={(project.roadmap?.steps?.length ?? 0) > 0}
                          onDegisti={loadStudentDetail}
                        />

                        {/* #394: AI kod incelemesi neden çalışmıyor — kural
                            değişmiyor, GÖRÜNÜR oluyor. Depo kurulmamışken
                            gösterilmiyor: henüz PR gelmeyecek. */}
                        {project.githubStatus !== "NOT_PROVISIONED" &&
                          student.kodIncelemesi?.[project.id] && (
                            <KodIncelemesiDurumuRozeti
                              durum={student.kodIncelemesi[project.id]}
                              githubStatus={project.githubStatus}
                            />
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* #48: Detaylı AI Profil Analizi (profil varsa) */}
      {student.studentProfile && (
        <div className="mt-6">
          <ProfileAnalysisCard analysis={student.studentProfile.profileAnalysis} />
        </div>
      )}

      {/* Project Assignment Modal (Aynı Kaldı) */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            ref={assignModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Proje Ata"
            tabIndex={-1}
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col outline-none"
          >

            <div className="flex justify-between items-center p-6 border-b bg-gray-50/80">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Proje Ata - {getStudentName()}</h2>
                <p className="text-sm text-gray-500 mt-1">Öğrencinin profiline en uygun projeyi seçin.</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleAIRecommend}
                  disabled={isAIThinking || templatesLoading}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm ${
                    isAIThinking || templatesLoading
                      ? "bg-[#3e92cc]/15 text-[#3e92cc] cursor-wait"
                      : "bg-gradient-to-r from-[#3e92cc] to-primary hover:from-[#2f7cb0] hover:to-[#1b2a55] text-primary-foreground shadow-[#3e92cc]/30"
                  }`}
                >
                  {isAIThinking || templatesLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isAIThinking ? "AI Analiz Ediyor..." : templatesLoading ? "Yükleniyor..." : "🤖 AI Öner"}
                </button>

                <button
                  onClick={() => setShowAssignModal(false)}
                  aria-label="Kapat"
                  className="text-gray-400 hover:text-gray-900 p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {aiError && (
                <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">AI Önerisi Başarısız</p>
                    <p className="mt-0.5 text-red-600">{aiError}</p>
                  </div>
                  <button onClick={() => setAiError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
                </div>
              )}
              {templatesError ? (
                /* #159: Şablon isteği patladığında "şablon yok" denmesin. */
                <div className="text-center py-12">
                  <AlertCircle className="w-7 h-7 text-red-500 mx-auto mb-3" />
                  <p className="text-slate-900 font-semibold">Proje şablonları yüklenemedi</p>
                  <p className="text-slate-500 text-sm mt-1 mb-4">
                    Bağlantıda bir sorun oluştu.
                  </p>
                  <button
                    onClick={loadProjectTemplates}
                    className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 transition-colors"
                  >
                    Tekrar Dene
                  </button>
                </div>
              ) : sortedProjectTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">Proje şablonu bulunamadı</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {sortedProjectTemplates.map(template => {
                    const isAssigned = getAssignedProjectIds().includes(template.id);
                    const difficultyInfo = difficultyConfig[template.difficulty];
                    const isLoadingThis = assigningId === template.id;
                    const aiRec = aiRecommendations.find(r => r.projectId === template.id);

                    return (
                      <div 
                        key={template.id} 
                        className={`flex flex-col border rounded-2xl overflow-hidden transition-all duration-300 ${
                          isAssigned ? 'bg-gray-50 border-gray-200 opacity-60' : 
                          aiRec ? 'border-[#3e92cc] shadow-lg shadow-[#3e92cc]/20 bg-[#3e92cc]/5 scale-[1.02]' : 
                          'hover:shadow-lg border-gray-200 bg-white hover:-translate-y-1'
                        }`}
                      >
                        {aiRec && !isAssigned && (
                          <div className="bg-gradient-to-r from-[#3e92cc]/15 to-[#3e92cc]/5 border-b border-[#3e92cc]/20 p-3.5">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="flex items-center text-[11px] font-bold text-primary uppercase tracking-wider">
                                <Sparkles className="w-3 h-3 mr-1" /> En İyi Eşleşme
                              </span>
                              <span className="text-[10px] font-bold text-primary-foreground bg-[#3e92cc] px-2 py-0.5 rounded-full shadow-sm">
                                %{aiRec.matchScore} Uyum
                              </span>
                            </div>
                            <p className="text-xs text-[#2f7cb0]/90 font-medium leading-relaxed">
                              {`"${aiRec.reason}"`}
                            </p>
                          </div>
                        )}

                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-3 gap-2">
                            <h3 className="font-bold text-gray-900 leading-snug">{template.title}</h3>
                            <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg ${difficultyInfo.color} shrink-0`}>
                              {difficultyInfo.label}
                            </span>
                          </div>
                          
                          <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">
                            {stripMarkdown(template.description)}
                          </p>
                          
                          <div className="flex flex-wrap gap-1.5 mb-5">
                            {template.track.slice(0, 3).map((tag, index) => (
                              <span key={index} className="px-2 py-1 text-[11px] font-semibold bg-gray-100 text-gray-600 rounded-md">
                                {tag}
                              </span>
                            ))}
                          </div>
                          
                          <button
                           onClick={() => assignProject(template.id)}
                           disabled={isAssigned || assigningId !== null}
                           className={`w-full py-3 px-4 rounded-xl font-bold transition-all duration-200 ${
                             isAssigned 
                               ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                               : aiRec 
                                 ? 'bg-primary hover:bg-[#1b2a55] text-primary-foreground shadow-md hover:shadow-lg' 
                                 : 'bg-gray-900 hover:bg-black text-white shadow-md'
                           }`}
                          >
                            {isAssigned ? 'Zaten Atanmış' : (isLoadingThis ? 'Atanıyor...' : 'Projeyi Ata')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}