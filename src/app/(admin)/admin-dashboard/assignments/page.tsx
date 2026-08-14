"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GitBranch,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  FolderGit2,
  Users,
  Layers,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export type StudentAssignmentProgress = {
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  experienceLevel: string;
  // #195: M:N — atanmış mentorlar (0..n).
  mentors: { id: string; name: string }[];
  projectTemplateId: string;
  projectTitle: string;
  projectDifficulty: string;
  assignmentStatus: string;
  githubRepoUrl: string | null;
  githubStatus: string;
  provisionedAt: Date | null;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  lastActivity: {
    title: string;
    updatedAt: Date;
  } | null;
  roadmapId: string | null;
  roadmapStatus: string | null;
};

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<StudentAssignmentProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"ALL" | "NOT_PROVISIONED" | "PROVISIONED">("ALL");

  // Modal State
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignmentProgress | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/assignments");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Veriler yüklenirken hata oluştu");
      }
      const data = await res.json();
      setAssignments(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Veriler yüklenirken hata oluştu";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleConfirmProvision() {
    if (!selectedAssignment) return;

    setIsProvisioning(true);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: selectedAssignment.assignmentId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "GitHub çalışma alanı oluşturulamadı");
      }

      // #179 review: Simülasyon modunda "başarıyla oluşturuldu" demek yanıltıcı —
      // GitHub'da fiziksel repo/issue açılmaz. Uyarı tonunda ve net ayırt edilir göster.
      if (data.simulated) {
        toast.warning("Önizleme (simülasyon) modunda hazırlandı", {
          description: `${data.message} GitHub'da gerçek repo/issue açılması için GITHUB_TOKEN tanımlanmalıdır.`,
          duration: 8000,
        });
      } else {
        toast.success("GitHub Çalışma Alanı Başarıyla Oluşturuldu!", {
          description: data.message,
        });
      }
      setSelectedAssignment(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Oluşturma başarısız oldu";
      toast.error("GitHub alanı oluşturulamadı", { description: msg });
    } finally {
      setIsProvisioning(false);
    }
  }

  const totalAssigned = assignments.length;
  const provisionedCount = assignments.filter((a) => a.githubStatus === "PROVISIONED").length;
  const avgProgress =
    totalAssigned > 0
      ? Math.round(assignments.reduce((acc, curr) => acc + curr.progressPercentage, 0) / totalAssigned)
      : 0;

  const filteredAssignments = assignments.filter((item) => {
    if (filterTab === "NOT_PROVISIONED") return item.githubStatus !== "PROVISIONED";
    if (filterTab === "PROVISIONED") return item.githubStatus === "PROVISIONED";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin-dashboard"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              &larr; Yönetici Paneline Dön
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Öğrenci Proje İlerlemesi & GitHub Yönetimi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Öğrencilerin projelerdeki canlı ilerleme durumunu takip edin, <span className="font-semibold text-indigo-600 dark:text-indigo-400">Posinowa</span> organizasyonu altında repoları ve detaylı AI Issue&apos;larını oluşturun.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Yenile
        </button>
      </div>

      {/* Filtre Tabları */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setFilterTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === "ALL"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          Tüm Atamalar ({assignments.length})
        </button>
        <button
          onClick={() => setFilterTab("NOT_PROVISIONED")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === "NOT_PROVISIONED"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          Repo Bekleyenler ({assignments.filter((a) => a.githubStatus !== "PROVISIONED").length})
        </button>
        <button
          onClick={() => setFilterTab("PROVISIONED")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === "PROVISIONED"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
          }`}
        >
          Repo Açılmış Projeler ({assignments.filter((a) => a.githubStatus === "PROVISIONED").length})
        </button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Atanan Toplam Proje</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{totalAssigned}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">GitHub Reposu Açılanlar</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{provisionedCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ortalama Tamamlanma Yüzdesi</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">%{avgProgress}</p>
          </div>
        </div>
      </div>

      {/* Tablo Konteynırı */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm">Öğrenci ilerlemeleri hesaplanıyor...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={loadData}
              className="mt-2 text-xs text-indigo-600 hover:underline font-semibold"
            >
              Yeniden Dene
            </button>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-sm font-medium">Henüz atanmış bir proje bulunmuyor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Öğrenci & Mentör</th>
                  <th className="py-4 px-6">Atanan Proje</th>
                  <th className="py-4 px-6">Canlı İlerleme</th>
                  <th className="py-4 px-6">Son Aktivite</th>
                  <th className="py-4 px-6 text-right">GitHub Çalışma Alanı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAssignments.map((item) => (
                  <tr
                    key={item.assignmentId}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Öğrenci & Mentör */}
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.studentName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.studentEmail} &bull;{" "}
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {item.experienceLevel}
                        </span>
                      </div>
                      {item.mentors.length > 0 && (
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3" />{" "}
                          {item.mentors.length > 1 ? "Mentörler" : "Mentör"}:{" "}
                          {item.mentors.map((m) => m.name).join(", ")}
                        </div>
                      )}
                    </td>

                    {/* Proje */}
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.projectTitle}
                      </div>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          item.projectDifficulty === "EASY"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : item.projectDifficulty === "MEDIUM"
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                            : "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                        }`}
                      >
                        {item.projectDifficulty}
                      </span>
                    </td>

                    {/* Canlı İlerleme Çubuğu */}
                    <td className="py-4 px-6 min-w-[200px]">
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-slate-700 dark:text-slate-300">
                          %{item.progressPercentage}
                        </span>
                        <span className="text-slate-400 font-normal">
                          {item.completedSteps} / {item.totalSteps} Adım
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${item.progressPercentage}%` }}
                        />
                      </div>
                    </td>

                    {/* Son Aktivite */}
                    <td className="py-4 px-6 text-xs text-slate-600 dark:text-slate-400">
                      {item.lastActivity ? (
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                            {item.lastActivity.title}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(item.lastActivity.updatedAt).toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Henüz hareket yok</span>
                      )}
                    </td>

                    {/* GitHub Aksiyon */}
                    <td className="py-4 px-6 text-right">
                      {item.githubStatus === "PROVISIONED" && item.githubRepoUrl ? (
                        <a
                          href={item.githubRepoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition text-xs font-semibold border border-emerald-200/60 dark:border-emerald-800"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          Repo&apos;ya Git
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : item.roadmapStatus === "PUBLISHED" || item.totalSteps > 0 ? (
                        <button
                          onClick={() => setSelectedAssignment(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          GitHub Workspace Oluştur
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Mentör Roadmap Bekleniyor
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GitHub Oluşturma Önizleme Modalı */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                GitHub Çalışma Alanı Oluştur
              </h3>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                Kapat
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Hedef Organizasyon:</span>{" "}
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">Posinowa</span> (github.com/Posinowa)
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Hedef Repo:</span>{" "}
                <code className="text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">
                  Posinowa/aisigner-{(selectedAssignment.studentName || "student").toLowerCase().replace(/[^a-z0-9]/g, "")}-{(selectedAssignment.projectTitle || "project").toLowerCase().replace(/[^a-z0-9]/g, "-")}
                </code>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Öğrenci:</span>{" "}
                {selectedAssignment.studentName} ({selectedAssignment.experienceLevel})
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Proje:</span>{" "}
                {selectedAssignment.projectTitle}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Oluşturulacak Faz Sayısı (Milestone):</span>{" "}
                {selectedAssignment.totalSteps} Faz
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Tahmini Açılacak Issue Sayısı:</span>{" "}
                ~{selectedAssignment.totalSteps * 3} AI Detaylı Issue
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bu akış, <strong className="text-slate-700 dark:text-slate-200">Posinowa</strong> organizasyonu için öğrenciye özel repo, faz (Milestone) ve AI ile detaylandırılmış görev (Issue) yapısını hazırlar.
            </p>

            {/* #178-1: Bu özellik şu an ÖNİZLEME/simülasyondur — dürüstçe belirtilir. */}
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <strong>Önizleme:</strong> Bu işlem şu an bir <strong>simülasyondur</strong>. AI görev
                içerikleri gerçekten üretilip kaydedilir, ancak GitHub&apos;da fiziksel bir repo/issue
                <strong> oluşturulmaz</strong> — üretilen linkler yer tutucudur. Gerçek GitHub entegrasyonu ayrı olarak planlanmaktadır.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                disabled={isProvisioning}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleConfirmProvision}
                disabled={isProvisioning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Onayla ve GitHub&apos;da Başlat
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
