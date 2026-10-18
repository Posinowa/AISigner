"use client";

import { AlertCircle, AlertTriangle, Clock, ExternalLink, GitBranch, Loader2, RefreshCw, Sparkles, Users } from "lucide-react";
import { tarihSaatBicimle } from "@/lib/tarih";
import type { StudentAssignmentProgress } from "@/features/admin/ui/atama-tipleri";

export type AtamaSatiriProps = {
  item: StudentAssignmentProgress;
  guncellenenId: string | null;
  onWorkspaceGuncelle: (assignmentId: string) => void;
  onSec: (item: StudentAssignmentProgress) => void;
};

/** Admin atama tablosunun tek satırı. */
export function AtamaSatiri({ item, guncellenenId, onWorkspaceGuncelle, onSec }: AtamaSatiriProps) {
  return (
      <tr
        key={item.assignmentId}
        className="hover:bg-slate-50/60 transition-colors"
      >
        {/* Öğrenci & Mentör */}
        <td className="py-4 px-6">
          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900">
            {item.studentName}
            {/* #367: Satırın takım mı birey mi olduğu görsel olarak
                ayırt edilebilmeli — takımda "öğrenci" sütunu tek bir
                kişiyi temsil etmiyor. */}
            {item.teamId && (
              <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                TAKIM
              </span>
            )}
          </div>
          {item.teamId ? (
            <div className="mt-0.5 text-xs text-slate-500">
              {item.teamMembers.length > 0
                ? item.teamMembers.map((u) => `${u.name} (${u.role})`).join(" · ")
                : "Aktif üye yok"}
            </div>
          ) : (
            <div className="text-xs text-slate-500 mt-0.5">
              {item.studentEmail} &bull;{" "}
              <span className="font-medium text-slate-600">
                {item.experienceLevel}
              </span>
            </div>
          )}
          {item.mentors.length > 0 && (
            <div className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
              <Users className="w-3 h-3" />{" "}
              {item.mentors.length > 1 ? "Mentörler" : "Mentör"}:{" "}
              {item.mentors.map((m) => m.name).join(", ")}
            </div>
          )}
        </td>

        {/* Proje */}
        <td className="py-4 px-6">
          <div className="font-medium text-slate-800">
            {item.projectTitle}
          </div>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
              item.projectDifficulty === "EASY"
                ? "bg-emerald-50 text-emerald-700"
                : item.projectDifficulty === "MEDIUM"
                ? "bg-indigo-50 text-indigo-700"
                : "bg-primary/5 text-primary"
            }`}
          >
            {item.projectDifficulty}
          </span>
        </td>

        {/* Canlı İlerleme Çubuğu */}
        <td className="py-4 px-6 min-w-[200px]">
          <div className="flex items-center justify-between text-xs font-semibold mb-1">
            <span className="text-slate-700">
              %{item.progressPercentage}
            </span>
            <span className="text-slate-400 font-normal">
              {item.completedSteps} / {item.totalSteps} Adım
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${item.progressPercentage}%` }}
            />
          </div>
        </td>

        {/* Son Aktivite */}
        <td className="py-4 px-6 text-xs text-slate-600">
          {item.lastActivity ? (
            <div>
              <div className="font-medium text-slate-800 truncate max-w-[180px]">
                {item.lastActivity.title}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {tarihSaatBicimle(item.lastActivity.updatedAt, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              {/* #432: Tarih vardı ama "ne kadar oldu" yoktu — admin
                  her satırda zihinden gün saymak zorundaydı.

                  ⚠️ SKOR DEĞİL SİNYAL (#331/#397): metin verinin
                  kendisi, uydurma bir risk yüzdesi değil. Eşik de
                  analitikteki `SESSIZLIK_GUN` ile AYNI. */}
              {item.duraklamaMetni && (
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {item.duraklamaMetni}
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400 italic">Henüz hareket yok</span>
          )}
        </td>

        {/* GitHub Aksiyon */}
        <td className="py-4 px-6 text-right">
          {item.githubStatus === "PROVISIONING" && !item.kurulumTakildi ? (
            // İş arka planda koşuyor. Buton YOK: ikinci bir kurulum
            // tetiklemek aynı repoya paralel yazma demek olurdu
            // (uç da bunu 400 ile reddediyor).
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Kuruluyor...
            </span>
          ) : item.githubStatus === "PROVISIONED" && item.githubRepoUrl ? (
            <div className="inline-flex items-center gap-2">
              <button
                onClick={() => onWorkspaceGuncelle(item.assignmentId)}
                disabled={guncellenenId === item.assignmentId}
                title="Yol haritasındaki değişiklikleri çalışma alanına aktar"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-slate-300 transition text-xs font-semibold disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${guncellenenId === item.assignmentId ? "animate-spin" : ""}`}
                />
                {guncellenenId === item.assignmentId ? "Güncelleniyor..." : "Güncelle"}
              </button>
              <a
                href={item.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition text-xs font-semibold border border-emerald-200/60"
              >
                <GitBranch className="w-3.5 h-3.5" />
                Repo&apos;ya Git
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : item.roadmapStatus === "PUBLISHED" || item.totalSteps > 0 ? (
            // ERROR: arka plan işi başarısız oldu YA DA süreç
            // yeniden başladığı için yarıda kaldı. Kurtarma
            // bilinçli olarak elle: admin burada tekrar dener.
            // (Kurulum idempotent — tekrar denemek kopya üretmez.)
            <button
              onClick={() => onSec(item)}
              className={
                item.githubStatus === "ERROR" || item.kurulumTakildi
                  ? "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-xs font-semibold transition"
                  : "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition shadow-sm"
              }
              title={
                item.kurulumTakildi
                  ? "Kurulum yarıda kalmış (sunucu yeniden başlamış olabilir). Tekrar denemek kopya oluşturmaz."
                  : item.githubStatus === "ERROR"
                    ? "Önceki kurulum tamamlanamadı. Tekrar denemek kopya oluşturmaz."
                    : undefined
              }
            >
              {item.githubStatus === "ERROR" || item.kurulumTakildi ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  {item.kurulumTakildi
                    ? "Kurulum Yarıda Kaldı — Tekrar Dene"
                    : "Kurulum Başarısız — Tekrar Dene"}
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  GitHub Workspace Oluştur
                </>
              )}
            </button>
          ) : (
            <span className="text-xs text-slate-400 italic">
              Mentör Roadmap Bekleniyor
            </span>
          )}
        </td>
      </tr>
  );
}
