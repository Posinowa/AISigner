"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, User, Calendar, Target, Clock, BookOpen, Plus, CheckCircle, AlertCircle,Trash2 } from "lucide-react";
import Link from "next/link";

type ProjectTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  track: string[];
};

type StudentDetail = {
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
    }[];
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
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params.studentId as string;
  const activeTab = searchParams.get("tab") || "profile";

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
 // const [assigning, setAssigning] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    loadStudentDetail();
    if (activeTab === "assign") {
      loadProjectTemplates();
      setShowAssignModal(true);
    }
  }, [studentId, activeTab]);

  async function loadStudentDetail() {
    try {
      // Bu API endpoint'ini oluşturmanız gerekecek
      const res = await fetch(`/api/mentor/students/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setStudent(data);
      }
    } catch (error) {
      console.error("Failed to load student detail:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectTemplates() {
    try {
      const res = await fetch("/api/admin/project-templates");
      if (res.ok) {
        const data = await res.json();
        setProjectTemplates(data);
      }
    } catch (error) {
      console.error("Failed to load project templates:", error);
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
        alert("Proje başarıyla atandı!");
      } else {
        const error = await res.json();
        alert(error.error || "Proje atama başarısız");
      }
    } catch (error) {
      console.error("Failed to assign project:", error);
      alert("Proje atama başarısız");
    } finally {
      setAssigningId(null);
    }
  }
  async function handleDeleteAssignment(assignedProjectId: string) {
    if (!confirm("Bu proje atamasını kaldırmak istediğinizden emin misiniz?")) return;

    try {
      const res = await fetch("/api/mentor/unassign-project", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedProjectId }),
      });

      if (res.ok) {
        // Listeyi yenile
        await loadStudentDetail();
      } else {
        alert("Silme işlemi başarısız oldu.");
      }
    } catch (error) {
      console.error("Silme hatası:", error);
      alert("Bir hata oluştu.");
    }
  }

  const getStudentName = () => {
    if (!student) return "";
    return [student.name, student.lastName].filter(Boolean).join(" ") || "İsimsiz Öğrenci";
  };

  const getAssignedProjectIds = () => {
    return student?.studentProfile?.assignedProjects?.map(p => p.projectTemplate.id) || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Öğrenci detayları yükleniyor...</span>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Öğrenci bulunamadı</h3>
          <p className="text-gray-600 mb-4">Bu öğrenci size atanmamış olabilir.</p>
          <Link href="/mentor-dashboard" className="text-blue-600 hover:text-blue-800">
            ← Dashboard'a dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
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
                  <p className="text-gray-900">{student.studentProfile.experienceLevel}</p>
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
                      <div key={project.id} className="border rounded-lg p-4 relative group">
      
 
                       <button 
                       onClick={() => handleDeleteAssignment(project.id)}
                        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 z-10"
                         title="Atamayı Kaldır"
                          >
                           <Trash2 className="w-4 h-4" />
                        </button>
                      
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">{project.projectTemplate.title}</h3>
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
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {project.projectTemplate.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-1">
                            {project.projectTemplate.track.slice(0, 3).map((tag, index) => (
                              <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                {tag}
                              </span>
                            ))}
                            {project.projectTemplate.track.length > 3 && (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                                +{project.projectTemplate.track.length - 3}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(project.createdAt).toLocaleDateString("tr-TR")}
                          </span>
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

      {/* Project Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">Proje Ata - {getStudentName()}</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {projectTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">Proje şablonu bulunamadı</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {projectTemplates.map(template => {
                    const isAssigned = getAssignedProjectIds().includes(template.id);
                    const difficultyInfo = difficultyConfig[template.difficulty];
                    
                    const isLoadingThis = assigningId === template.id; //'isLoading' durumu sadece o anki proje ID'si 'assigningId' ile eşleşiyorsa true olur.
                    return (
                      <div key={template.id} className={`border rounded-lg p-4 ${isAssigned ? 'bg-gray-50 border-gray-300' : 'hover:shadow-md transition-shadow'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">{template.title}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${difficultyInfo.color}`}>
                            {difficultyInfo.label}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {template.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-1 mb-3">
                          {template.track.slice(0, 3).map((tag, index) => (
                            <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                              {tag}
                            </span>
                          ))}
                          {template.track.length > 3 && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                              +{template.track.length - 3} daha
                            </span>
                          )}
                        </div>
                        
                        <button
                        onClick={() => assignProject(template.id)}
                          // Eğer bu proje zaten atanmışsa disable et
                          // VEYA şu an HERHANGİ bir proje atanıyorsa (assigningId !== null) da butonu kilitle.
                          // (Bu, aynı anda birden fazla projeye basılmasını engeller)
                          disabled={isAssigned || assigningId !== null}
                         
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                            isAssigned 
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                         {isAssigned ? 'Zaten Atanmış' : (isLoadingThis ? 'Atanıyor...' : 'Projeyi Ata')}
                        </button>
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