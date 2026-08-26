"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, BookOpen, Clock, CheckCircle, AlertCircle, UserCircle2, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { experienceLevelLabel } from "@/lib/experience-level";

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
  PENDING: { label: "Bekliyor", color: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300", icon: Clock },
  IN_PROGRESS: { label: "Devam Ediyor", color: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300", icon: AlertCircle },
  COMPLETED: { label: "Tamamlandı", color: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300", icon: CheckCircle }
};

const difficultyConfig = {
  EASY: { label: "Kolay", color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200" },
  MEDIUM: { label: "Orta", color: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200" },
  HARD: { label: "Zor", color: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200" }
};

export default function MentorDashboardPage() {
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await fetch("/api/mentor/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      } else {
        setError(true);
      }
    } catch (error) {
      console.error("Failed to load students:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const getStudentName = (student: StudentWithProfile) => {
    return [student.name, student.lastName].filter(Boolean).join(" ") || "İsimsiz Öğrenci";
  };

  const getInitials = (student: StudentWithProfile) => {
    const parts = [student.name, student.lastName].filter(Boolean);
    return parts.map(p => p![0].toUpperCase()).join("") || "?";
  };

  const getActiveProjects = (student: StudentWithProfile) =>
    student.studentProfile?.assignedProjects?.filter(p => p.status !== "COMPLETED").length || 0;

  const getCompletedProjects = (student: StudentWithProfile) =>
    student.studentProfile?.assignedProjects?.filter(p => p.status === "COMPLETED").length || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin h-7 w-7 text-blue-600 dark:text-blue-400 mr-3" />
        <span className="text-slate-600 dark:text-slate-300 font-medium">Öğrenciler yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Öğrenciler yüklenemedi</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-5">
          Bağlantıda bir sorun oluştu. Lütfen tekrar deneyin.
        </p>
        <button
          onClick={loadStudents}
          className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  const totalActive = students.reduce((acc, s) => acc + getActiveProjects(s), 0);
  const totalCompleted = students.reduce((acc, s) => acc + getCompletedProjects(s), 0);
  const missingProfile = students.filter(s => !s.studentProfile).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-6xl mx-auto p-6">

        {/* Sayfa başlığı — navigasyon/çıkış AppShell'de (#126-1) */}
        <div className="mb-8 pt-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Mentor Paneli</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm">Size atanmış öğrencileri yönetin ve proje atayın</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40", label: "Toplam Öğrenci", value: students.length },
            { icon: BookOpen, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40", label: "Aktif Projeler", value: totalActive },
            { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40", label: "Tamamlanan", value: totalCompleted },
            { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40", label: "Profil Eksik", value: missingProfile },
          ].map(({ icon: Icon, color, label, value }) => (
            <div key={label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Student List */}
        {students.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Henüz öğrenci yok</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Size atanmış öğrenci bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {students.map(student => {
              const activeCount = getActiveProjects(student);
              const completedCount = getCompletedProjects(student);
              const hasProfile = !!student.studentProfile;
              const expLevel = hasProfile
                ? experienceLevelLabel(student.studentProfile!.experienceLevel)
                : null;

              return (
                <div
                  key={student.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
                >
                  {/* Card top stripe */}
                  <div className={`h-1 ${hasProfile ? "bg-gradient-to-r from-blue-500 to-indigo-500" : "bg-gradient-to-r from-amber-400 to-orange-400"}`} />

                  <div className="p-5 flex flex-col flex-1">
                    {/* Student avatar + info */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${
                        hasProfile ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-slate-400 to-slate-500"
                      }`}>
                        {getInitials(student)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{getStudentName(student)}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{student.email}</p>
                      </div>
                      {!hasProfile && (
                        <span className="shrink-0 px-2 py-1 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 rounded-lg">
                          Profil Yok
                        </span>
                      )}
                    </div>

                    {/* Profile summary */}
                    {hasProfile && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {expLevel && (
                          <span className="px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg">
                            {expLevel}
                          </span>
                        )}
                        {student.studentProfile!.interests.slice(0, 2).map((interest, i) => (
                          <span key={i} className="px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg">
                            {interest}
                          </span>
                        ))}
                        {student.studentProfile!.interests.length > 2 && (
                          <span className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500 rounded-lg bg-slate-50 dark:bg-slate-950">
                            +{student.studentProfile!.interests.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Project stats */}
                    {hasProfile && (
                      <div className="flex gap-3 mb-4">
                        <div className="flex-1 bg-blue-50 dark:bg-blue-950/40 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{activeCount}</p>
                          <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 font-medium mt-0.5">Aktif</p>
                        </div>
                        <div className="flex-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{completedCount}</p>
                          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5">Tamamlandı</p>
                        </div>
                      </div>
                    )}

                    {/* Recent projects */}
                    {student.studentProfile?.assignedProjects && student.studentProfile.assignedProjects.length > 0 && (
                      <div className="mb-4 space-y-1.5">
                        {student.studentProfile.assignedProjects.slice(0, 2).map(project => {
                          const statusInfo = statusConfig[project.status as keyof typeof statusConfig];
                          const difficultyInfo = difficultyConfig[project.projectTemplate.difficulty as keyof typeof difficultyConfig];
                          return (
                            <div key={project.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2">
                              <span className="text-xs text-slate-700 dark:text-slate-200 truncate font-medium">
                                {project.projectTemplate.title}
                              </span>
                              <div className="flex gap-1.5 shrink-0">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${difficultyInfo.color}`}>
                                  {difficultyInfo.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-auto flex gap-2 pt-1">
                      <Link
                        href={`/mentor-dashboard/${student.id}`}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium py-2.5 px-3 rounded-xl text-center transition-colors flex items-center justify-center gap-1.5"
                      >
                        <UserCircle2 className="w-3.5 h-3.5" />
                        Detaylar
                        <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                      </Link>
                      {hasProfile && (
                        <Link
                          href={`/mentor-dashboard/${student.id}?tab=assign`}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2.5 px-3.5 rounded-xl transition-colors flex items-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Ata
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
