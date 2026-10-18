"use client";

import Link from "next/link";
import { useAtamaIlerlemesi } from "@/features/admin/hooks/useAtamaIlerlemesi";

import { Loader2, RefreshCw, FolderGit2, Users, Layers, AlertCircle } from "lucide-react";

import { AtamaSatiri } from "@/features/admin/ui/AtamaSatiri";

import { GithubOnizlemeModali } from "@/features/admin/ui/GithubOnizlemeModali";

export default function AdminAssignmentsPage() {
  const {
    assignments,
    isLoading,
    error,
    filterTab,
    setFilterTab,
    mentorFiltresi,
    setMentorFiltresi,
    nextCursor,
    dahaYukleniyor,
    sayaclar,
    selectedAssignment,
    setSelectedAssignment,
    isProvisioning,
    loadData,
    guncellenenId,
    gercekEntegrasyon,
    handleWorkspaceGuncelle,
    handleConfirmProvision,
    totalAssigned,
    provisionedCount,
    avgProgress,
    mentorSecenekleri,
    filteredAssignments,
  } = useAtamaIlerlemesi();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin-dashboard"
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              &larr; Yönetici Paneline Dön
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Öğrenci Proje İlerlemesi & GitHub Yönetimi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Öğrencilerin projelerdeki canlı ilerleme durumunu takip edin, <span className="font-semibold text-indigo-600">Posinowa</span> organizasyonu altında repoları ve detaylı AI Issue&apos;larını oluşturun.
          </p>

          {/* #218: Mod göstergesi. Simülasyonda üretilen repo/issue
              bağlantıları GitHub'da 404 verir; admin bunu işlem YAPMADAN
              önce bilmeli. */}
          {gercekEntegrasyon === false && (
            <p
              role="status"
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"
            >
              Önizleme modu — GitHub&apos;da gerçek repo veya issue oluşturulmaz.
              Etkinleştirmek için <code className="font-mono">GITHUB_TOKEN</code> tanımlayın.
            </p>
          )}
          {gercekEntegrasyon === true && (
            <p
              role="status"
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
            >
              Gerçek GitHub entegrasyonu etkin — işlemler kalıcıdır.
            </p>
          )}
        </div>

        <button
          onClick={() => loadData()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Yenile
        </button>
      </div>

      {/* Filtre Tabları */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setFilterTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === "ALL"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Tüm Atamalar ({sayaclar.toplam})
        </button>
        <button
          onClick={() => setFilterTab("NOT_PROVISIONED")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === "NOT_PROVISIONED"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Repo Bekleyenler ({sayaclar.kurulmamis})
        </button>
        <button
          onClick={() => setFilterTab("PROVISIONED")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            filterTab === "PROVISIONED"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Repo Açılmış Projeler ({sayaclar.kurulu})
        </button>

        {/* #432: MENTÖRE GÖRE FİLTRE — admin "şu mentörün öğrencileri ne
            durumda" sorusunu tek bakışta yanıtlayabilsin.

            ⚠️ FİLTRE, SIRALAMA DEĞİL: #331'de mentörleri yanıt süresine göre
            sıralayan bir liste bilerek reddedilmişti. */}
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="mentor-filtresi" className="text-xs font-medium text-slate-600">
            Mentör
          </label>
          <select
            id="mentor-filtresi"
            value={mentorFiltresi}
            onChange={(e) => setMentorFiltresi(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="HEPSI">Hepsi</option>
            {mentorSecenekleri.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            {/* Mentörsüz atamalar tam da gözünden kaçmaması gereken satırlar. */}
            <option value="MENTORSUZ">Mentörü yok</option>
          </select>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-indigo-500/10 text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Atanan Toplam Proje</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{totalAssigned}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">GitHub Reposu Açılanlar</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{provisionedCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-primary/10 text-primary">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Ortalama Tamamlanma Yüzdesi</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">%{avgProgress}</p>
          </div>
        </div>
      </div>

      {/* Tablo Konteynırı */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
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
              onClick={() => loadData()}
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
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Öğrenci & Mentör</th>
                  <th className="py-4 px-6">Atanan Proje</th>
                  <th className="py-4 px-6">Canlı İlerleme</th>
                  <th className="py-4 px-6">Son Aktivite</th>
                  <th className="py-4 px-6 text-right">GitHub Çalışma Alanı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((item) => (
                  <AtamaSatiri
                    key={item.assignmentId}
                    item={item}
                    guncellenenId={guncellenenId}
                    onWorkspaceGuncelle={handleWorkspaceGuncelle}
                    onSec={(secilen) => setSelectedAssignment(secilen)}
                  />
                ))}
              </tbody>
            </table>

            {/*
              #452: İmleçli sayfalama. Sayfa numarası YOK — atamalar
              `createdAt desc, id desc` ile sıralanıyor ve araya yeni atama
              girdiğinde numaralı sayfalar kayar (satır atlanır ya da
              tekrarlanır). #448'de aynı tercih yapılmıştı.
            */}
            {nextCursor && (
              <div className="flex justify-center border-t border-slate-100 py-4">
                <button
                  type="button"
                  onClick={() => loadData({ cursor: nextCursor })}
                  disabled={dahaYukleniyor}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {dahaYukleniyor ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Yükleniyor...
                    </>
                  ) : (
                    <>Daha fazla göster ({assignments.length} / {sayaclar.toplam})</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GitHub Oluşturma Önizleme Modalı */}
      {selectedAssignment && (
        <GithubOnizlemeModali
          selectedAssignment={selectedAssignment}
          isProvisioning={isProvisioning}
          onKapat={() => setSelectedAssignment(null)}
          onOnayla={handleConfirmProvision}
        />
      )}
    </div>
  );
}
