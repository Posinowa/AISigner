"use client";

import { useEffect, useState } from "react";
import { Users, BookOpen, Clock, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

type StudentWithProfile = {
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
      projectTemplate: {
        id: string;
        title: string;
        difficulty: string;
      };
      createdAt: Date;
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

export default function MentorDashboardPage() {
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    try {
      setLoading(true);
      const res = await fetch("/api/mentor/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (error) {
      console.error("Failed to load students:", error);
    } finally {
      setLoading(false);
    }
  }

  const getStudentName = (student: StudentWithProfile) => {
    return [student.name, student.lastName].filter(Boolean).join(" ") || "İsimsiz Öğrenci";
  };

  const getActiveProjects = (student: StudentWithProfile) => {
    return student.studentProfile?.assignedProjects?.filter(
      p => p.status !== "COMPLETED"
    ).length || 0;
  };

  const getCompletedProjects = (student: StudentWithProfile) => {
    return student.studentProfile?.assignedProjects?.filter(
      p => p.status === "COMPLETED"
    ).length || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Öğrenciler yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mentor Dashboard</h1>
        <p className="text-gray-600 mt-1">Size atanmış öğrencileri yönetin ve proje atayın</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Toplam Öğrenci</p>
              <p className="text-2xl font-bold text-gray-900">{students.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <BookOpen className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aktif Projeler</p>
              <p className="text-2xl font-bold text-gray-900">
                {students.reduce((acc, student) => acc + getActiveProjects(student), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tamamlanan</p>
              <p className="text-2xl font-bold text-gray-900">
                {students.reduce((acc, student) => acc + getCompletedProjects(student), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Profil Eksik</p>
              <p className="text-2xl font-bold text-gray-900">
                {students.filter(s => !s.studentProfile).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Students List */}
      {students.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz öğrenci yok</h3>
          <p className="text-gray-600">Size atanmış öğrenci bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {students.map(student => (
            <div key={student.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Student Info */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {getStudentName(student)}
                    </h3>
                    <p className="text-sm text-gray-600">{student.email}</p>
                  </div>
                  {!student.studentProfile && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                      Profil Yok
                    </span>
                  )}
                </div>

                {/* Profile Summary */}
                {student.studentProfile && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Seviye:</span> {student.studentProfile.experienceLevel}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">İlgi Alanları:</span> {student.studentProfile.interests.length} alan
                    </p>
                    {student.studentProfile.birthYear && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Yaş:</span> ~{new Date().getFullYear() - student.studentProfile.birthYear}
                      </p>
                    )}
                  </div>
                )}

                {/* Project Stats */}
                <div className="flex gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{getActiveProjects(student)}</p>
                    <p className="text-xs text-gray-600">Aktif</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{getCompletedProjects(student)}</p>
                    <p className="text-xs text-gray-600">Tamamlandı</p>
                  </div>
                </div>

                {/* Recent Projects */}
                {student.studentProfile?.assignedProjects && student.studentProfile.assignedProjects.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">Son Projeler:</p>
                    <div className="space-y-1">
                      {student.studentProfile.assignedProjects.slice(0, 2).map(project => {
                        const statusInfo = statusConfig[project.status as keyof typeof statusConfig];
                        const difficultyInfo = difficultyConfig[project.projectTemplate.difficulty as keyof typeof difficultyConfig];
                        
                        return (
                          <div key={project.id} className="flex items-center justify-between text-xs">
                            <span className="truncate mr-2" title={project.projectTemplate.title}>
                              {project.projectTemplate.title.slice(0, 20)}...
                            </span>
                            <div className="flex gap-1 flex-shrink-0">
                              <span className={`px-1 py-0.5 rounded text-xs ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                              <span className={`px-1 py-0.5 rounded text-xs ${difficultyInfo.color}`}>
                                {difficultyInfo.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/mentor-dashboard/${student.id}`}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded text-center transition-colors"
                  >
                    Detayları Görüntüle
                  </Link>
                  {student.studentProfile && (
                    <Link
                      href={`/mentor-dashboard/${student.id}?tab=assign`}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors"
                    >
                      Proje Ata
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}