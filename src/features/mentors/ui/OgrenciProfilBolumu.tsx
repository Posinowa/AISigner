"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { taslakMi, TASLAK_ROZETI, TASLAK_SONUCU } from "@/features/roadmap/taslak";
import { KodIncelemesiDurumuRozeti } from "@/features/kvkk/ui/KodIncelemesiDurumu";
import { CalismaAlaniBolumu } from "@/features/workspace-requests/ui/CalismaAlaniBolumu";
import { experienceLevelLabel } from "@/lib/experience-level";
import { stripMarkdown } from "@/lib/markdown-preview";
import { tarihBicimle } from "@/lib/tarih";
import { PROJE_DURUMU_ETIKETI, ZORLUK_ETIKETI } from "@/lib/ui/proje-durumu";
import { AlertCircle, BookOpen, Github, Loader2, Map, Plus, Sparkles, Trash2, User, Users } from "lucide-react";
import type { StudentDetail } from "@/features/mentors/ui/ogrenci-detay-tipleri";

export type OgrenciProfilBolumuProps = {
  student: StudentDetail;
  setShowAssignModal: Dispatch<SetStateAction<boolean>>;
  handleDeleteAssignment: (assignedProjectId: string) => void | Promise<void>;
  handleGenerateRoadmap: (assignedProjectId: string) => void | Promise<void>;
  yonlendirmeler: Record<string, string>;
  setYonlendirmeler: Dispatch<SetStateAction<Record<string, string>>>;
  generatingRoadmapId: string | null;
  loadProjectTemplates: () => unknown;
  loadStudentDetail: () => unknown;
};

/** Öğrenci detay sayfasının profil, proje ve yol haritası bölümü. */
export function OgrenciProfilBolumu({
  student,
  setShowAssignModal,
  handleDeleteAssignment,
  handleGenerateRoadmap,
  yonlendirmeler,
  setYonlendirmeler,
  generatingRoadmapId,
  loadProjectTemplates,
  loadStudentDetail,
}: OgrenciProfilBolumuProps) {
  return (
    <>
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
                  const statusInfo = PROJE_DURUMU_ETIKETI[project.status as keyof typeof PROJE_DURUMU_ETIKETI];
                  const difficultyInfo = ZORLUK_ETIKETI[project.projectTemplate.difficulty as keyof typeof ZORLUK_ETIKETI];
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
                    
                      {/* #442: Takım satırı BİREYSELMİŞ GİBİ durmamalı — pano
                          ortak, yapılan iş tüm takımı etkiliyor. */}
                      {project.takim && (
                        <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                            <Users className="h-3 w-3" />
                            Takım: {project.takim.name}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {project.takim.members
                              .map(
                                (m) =>
                                  [m.studentProfile.user.name, m.studentProfile.user.lastName]
                                    .filter(Boolean)
                                    .join(" ") || m.studentProfile.user.email,
                              )
                              .join(" · ")}
                          </span>
                        </div>
                      )}

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
                          {tarihBicimle(project.createdAt)}
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
                          project.takim ? (
                          /* ⚠️ #332: TAKIMDA AI YOL HARİTASI ÜRETİMİ KAPALI (açık 400).
                             Düğmeyi göstermek mentörü hataya sürüklerdi; sebep
                             yazılı (#442). */
                          <p className="w-full text-sm text-gray-500">
                            Takım projelerinde AI yol haritası üretilmiyor — üretilen
                            içeriğin kime göre ayarlandığı belirsiz kalırdı. Adımları
                            ortak panodan elle ekleyebilirsiniz.
                          </p>
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
                          )
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
    </>
  );
}
