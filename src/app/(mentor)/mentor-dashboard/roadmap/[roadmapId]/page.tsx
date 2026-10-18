"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useYolHaritasiDuzenleme } from "@/features/mentors/hooks/useYolHaritasiDuzenleme";

import { ArrowLeft, Save, Plus, Pencil, X, Sparkles, Send, AlertTriangle, Loader2 } from "lucide-react";

import { TASLAK_SONUCU } from "@/features/roadmap/taslak";

import { YeniAdimFormu } from "@/features/roadmap/ui/YeniAdimFormu";

import { PosilogAdimModali } from "@/features/roadmap/ui/PosilogAdimModali";

import { RoadmapAdimKarti } from "@/features/roadmap/ui/RoadmapAdimKarti";

/* ─── Sayfa ─── */

export default function RoadmapReviewPage() {
  const { data: sessionData } = useSession();
  const {
    router,
    roadmap,
    loading,
    saving,
    publishing,
    editingStepId,
    editForm,
    setEditForm,
    showAddForm,
    setShowAddForm,
    newStepForm,
    setNewStepForm,
    generatingAiStep,
    showAiModal,
    setShowAiModal,
    aiPrompt,
    setAiPrompt,
    handleGenerateAIStep,
    expandedStepId,
    setExpandedStepId,
    loadRoadmap,
    editingTitle,
    setEditingTitle,
    titleValue,
    setTitleValue,
    handleSaveTitle,
    tasinan,
    handleTasi,
    handlePublish,
    startEditStep,
    cancelEditStep,
    handleSaveStep,
    handleDeleteStep,
    handleAddStep,
    editKaynak,
    yeniKaynak,
    totalHours,
  } = useYolHaritasiDuzenleme();

  /* ─── Loading / Not Found ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-gray-600">Yol haritası yükleniyor...</span>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center py-20">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Yol haritası bulunamadı</h3>
        <Link href="/mentor-dashboard" className="text-primary hover:text-[#3e92cc]">
          ← Dashboard&apos;a dön
        </Link>
      </div>
    );
  }

  const student = roadmap.assignedProject.studentProfile.user;
  const studentName = [student.name, student.lastName].filter(Boolean).join(" ") || "İsimsiz Öğrenci";
  const project = roadmap.assignedProject.projectTemplate;
  const isDraft = roadmap.status === "DRAFT";

  /* ─── Render ─── */
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  className="min-w-0 flex-1 text-xl font-bold text-gray-900 border-b-2 border-primary outline-none bg-transparent py-1"
                  autoFocus
                />
                <button onClick={handleSaveTitle} disabled={saving} className="text-primary hover:text-[#3e92cc]">
                  <Save className="w-5 h-5" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-primary transition-colors group"
                onClick={() => {
                  setTitleValue(roadmap.title);
                  setEditingTitle(true);
                }}
              >
                {roadmap.title}
                <Pencil className="w-4 h-4 ml-2 inline text-gray-300 group-hover:text-[#3e92cc] transition-colors" />
              </h1>
            )}
            <p className="text-sm text-gray-500 mt-1">
              {studentName} &middot; {project.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider ${
              isDraft
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {isDraft ? "Taslak" : "Yayında"}
          </span>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isDraft
                ? "bg-green-600 hover:bg-green-700 text-white shadow-sm"
                : "bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm"
            }`}
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDraft ? (
              <Send className="w-4 h-4" />
            ) : (
              <Pencil className="w-4 h-4" />
            )}
            {isDraft ? "Onayla ve Yayınla" : "Taslağa Al"}
          </button>
        </div>
      </div>

      {/* #405: Rozet durumu söylüyordu, SONUCUNU değil. Mentör "Taslak"ı
          görüp stajyerin hiçbir adımı göremediğini fark etmiyordu.

          ⚠️ Uyarı ENGELLEYİCİ DEĞİL: düzenleme sırasında taslağa geri almak
          meşru bir işlem. Amaç durdurmak değil, unutulmasını önlemek. */}
      {isDraft && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Bu yol haritası henüz taslak.
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-amber-800">
              {TASLAK_SONUCU}
            </p>
          </div>
        </div>
      )}

      {/* Proje Bilgisi + İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Proje</div>
          <div className="text-sm font-semibold text-gray-900">{project.title}</div>
          <div className="flex gap-1 mt-2">
            {project.track.slice(0, 3).map((t, i) => (
              <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Toplam Adım</div>
          <div className="text-2xl font-bold text-primary">{roadmap.steps.length}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Tahmini Süre</div>
          <div className="text-2xl font-bold text-blue-700">{totalHours} <span className="text-sm font-normal text-gray-500">saat</span></div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Öğrenci</div>
          <div className="text-sm font-semibold text-gray-900">{studentName}</div>
          <div className="text-xs text-gray-500 mt-1">{student.email}</div>
        </div>
      </div>

      {/* Adımlar Listesi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Yol Haritası Adımları
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-gradient-to-r from-primary to-[#3e92cc] hover:from-[#1b2a55] hover:to-[#2f7cb0] text-primary-foreground rounded-lg transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Posilog ile Adım Üret
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adım Ekle
            </button>
          </div>
        </div>

        {roadmap.steps.map((step, index) => (
          <RoadmapAdimKarti
            key={step.id}
            step={step}
            index={index}
            toplamAdim={roadmap.steps.length}
            isExpanded={expandedStepId === step.id}
            isEditing={editingStepId === step.id}
            tasinan={tasinan}
            editForm={editForm}
            setEditForm={setEditForm}
            editKaynak={editKaynak}
            saving={saving}
            kullanici={sessionData?.user}
            setExpandedStepId={setExpandedStepId}
            handleTasi={handleTasi}
            startEditStep={startEditStep}
            cancelEditStep={cancelEditStep}
            handleSaveStep={handleSaveStep}
            handleDeleteStep={handleDeleteStep}
            loadRoadmap={loadRoadmap}
          />
        ))}

        {/* Yeni Adım Ekleme Formu */}
        {showAddForm && (
          <YeniAdimFormu
            newStepForm={newStepForm}
            setNewStepForm={setNewStepForm}
            setShowAddForm={setShowAddForm}
            saving={saving}
            handleAddStep={handleAddStep}
            yeniKaynak={yeniKaynak}
          />
        )}
      </div>

      {/* 🤖 Posilog AI Asistanı Modal */}
      {showAiModal && (
        <PosilogAdimModali
          studentName={studentName}
          projectTitle={project.title}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          setShowAiModal={setShowAiModal}
          generatingAiStep={generatingAiStep}
          handleGenerateAIStep={handleGenerateAIStep}
        />
      )}
    </div>
  );
}
