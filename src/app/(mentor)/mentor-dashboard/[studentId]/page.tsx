"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { StudentDetail } from "@/features/mentors/ui/ogrenci-detay-tipleri";
import { OgrenciProfilBolumu } from "@/features/mentors/ui/OgrenciProfilBolumu";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ProfileAnalysisCard } from "@/features/ai/ui/ProfileAnalysisCard";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useModalA11y } from "@/components/ui/useModalA11y";
import { ProjeAtamaModali, type AIRecommendation, type ProjectTemplate } from "@/features/mentors/ui/ProjeAtamaModali";

// 🚀 SPRINT 3: Roadmap tipleri eklendi

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

      <OgrenciProfilBolumu
        student={student}
        setShowAssignModal={setShowAssignModal}
        handleDeleteAssignment={handleDeleteAssignment}
        handleGenerateRoadmap={handleGenerateRoadmap}
        yonlendirmeler={yonlendirmeler}
        setYonlendirmeler={setYonlendirmeler}
        generatingRoadmapId={generatingRoadmapId}
        loadProjectTemplates={loadProjectTemplates}
        loadStudentDetail={loadStudentDetail}
      />


      {/* #48: Detaylı AI Profil Analizi (profil varsa) */}
      {student.studentProfile && (
        <div className="mt-6">
          <ProfileAnalysisCard analysis={student.studentProfile.profileAnalysis} />
        </div>
      )}

      {/* Project Assignment Modal */}
      {showAssignModal && (
        <ProjeAtamaModali
          dialogRef={assignModalRef}
          studentName={getStudentName()}
          onKapat={() => setShowAssignModal(false)}
          sortedProjectTemplates={sortedProjectTemplates}
          templatesLoading={templatesLoading}
          templatesError={templatesError}
          loadProjectTemplates={loadProjectTemplates}
          isAIThinking={isAIThinking}
          handleAIRecommend={handleAIRecommend}
          aiError={aiError}
          setAiError={setAiError}
          aiRecommendations={aiRecommendations}
          assigningId={assigningId}
          assignProject={assignProject}
          getAssignedProjectIds={getAssignedProjectIds}
        />
      )}
    </div>
  );
}