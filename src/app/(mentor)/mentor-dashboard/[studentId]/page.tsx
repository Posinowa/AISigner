"use client";

import { OgrenciProfilBolumu } from "@/features/mentors/ui/OgrenciProfilBolumu";
import { useOgrenciDetayi } from "@/features/mentors/hooks/useOgrenciDetayi";

import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";

import Link from "next/link";

import { ProfileAnalysisCard } from "@/features/ai/ui/ProfileAnalysisCard";

import { ProjeAtamaModali } from "@/features/mentors/ui/ProjeAtamaModali";

// 🚀 SPRINT 3: Roadmap tipleri eklendi

export default function StudentDetailPage() {
  const {
    student,
    loading,
    loadError,
    templatesError,
    assigningId,
    showAssignModal,
    setShowAssignModal,
    assignModalRef,
    isAIThinking,
    aiRecommendations,
    aiError,
    setAiError,
    templatesLoading,
    generatingRoadmapId,
    loadStudentDetail,
    loadProjectTemplates,
    handleAIRecommend,
    assignProject,
    handleDeleteAssignment,
    yonlendirmeler,
    setYonlendirmeler,
    handleGenerateRoadmap,
    getStudentName,
    getAssignedProjectIds,
    sortedProjectTemplates,
  } = useOgrenciDetayi();

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