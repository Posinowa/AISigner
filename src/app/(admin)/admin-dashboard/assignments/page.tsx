"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  FolderGit2,
  Users,
  Layers,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { StudentAssignmentProgress } from "@/features/admin/ui/atama-tipleri";
import { AtamaSatiri } from "@/features/admin/ui/AtamaSatiri";
import { GithubOnizlemeModali } from "@/features/admin/ui/GithubOnizlemeModali";

/** #452: Sunucudan gelen sayaçlar. Sunucu modülünü import etmiyoruz —
    `assignment-progress.ts` prisma çekiyor ve istemci paketine sızardı. */
type AtamaSayaclari = {
  toplam: number;
  kurulu: number;
  kurulmamis: number;
  ortalamaIlerleme: number;
};

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<StudentAssignmentProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"ALL" | "NOT_PROVISIONED" | "PROVISIONED">("ALL");
  /*
   * #432: MENTÖRE GÖRE FİLTRE. Sayfa düz bir atama listesiydi; "şu
   * mentörün öğrencileri toplu hâlde ne durumda" diye bakılamıyordu.
   *
   * ⚠️ FİLTRE, SIRALAMA DEĞİL. #331'de mentörleri yanıt süresine göre
   * sıralayan bir liste BİLEREK reddedilmişti — bir insanı ölçüp
   * sıralamak olurdu. Burada da yalnızca kapsam daraltılıyor.
   */
  const [mentorFiltresi, setMentorFiltresi] = useState<string>("HEPSI");

  /*
   * #452: SÜZME VE SAYFALAMA SUNUCUDA.
   *
   * Öncesinde uç TÜM atamaları döndürüyor, süzme burada yapılıyordu.
   * Ölçüldü (1406 atama, üretim derlemesi): tek istek 1.04 MB. Sayfa
   * büyüdükçe her ziyaret o gövdeyi indirmek zorundaydı.
   *
   * ⚠️ SAYAÇLAR SUNUCUDAN GELİR, listeden sayılmaz — sayfalanan bir listede
   * istemcide sayılan sayaç "yüklenmiş kadarını" gösterir ve panelin verdiği
   * rakam sessizce yanlış olur (#448'de aynı karar).
   */
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);
  const [sayaclar, setSayaclar] = useState<AtamaSayaclari>({
    toplam: 0,
    kurulu: 0,
    kurulmamis: 0,
    ortalamaIlerleme: 0,
  });

  /*
   * #452: Mentör seçenekleri ARTIK ATAMALARDAN TÜRETİLMİYOR. Sayfalamayla
   * birlikte liste yalnız ilk sayfayı içeriyor; oradan türetilen bir açılır
   * menü mentörlerin çoğunu göstermezdi. Kendi ucundan geliyor (#404) — o
   * yanıt 6 KB.
   */
  const [mentorler, setMentorler] = useState<{ id: string; name: string | null; lastName: string | null; email: string }[]>([]);

  // Modal State
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignmentProgress | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);

  /**
   * @param cursor  verilirse sonraki sayfa EKLENİR, verilmezse liste tazelenir
   * @param koru    tazelemede o ana kadar yüklenmiş kayıt sayısını koru
   *                (kurulum yoklaması listeyi ilk sayfaya düşürmesin)
   */
  async function loadData(opts?: { cursor?: string; koru?: number }) {
    const ekle = Boolean(opts?.cursor);
    if (ekle) setDahaYukleniyor(true);
    else setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (filterTab !== "ALL") qs.set("durum", filterTab);
      if (mentorFiltresi !== "HEPSI") qs.set("mentor", mentorFiltresi);
      if (opts?.cursor) qs.set("cursor", opts.cursor);
      // Sunucu üst sınırı 200; tazelemede daha fazlası zaten sayfalanır.
      if (opts?.koru && opts.koru > 0) qs.set("limit", String(Math.min(opts.koru, 200)));

      const res = await fetch(`/api/admin/assignments?${qs.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Veriler yüklenirken hata oluştu");
      }
      const data = await res.json();
      setAssignments((onceki) => (ekle ? [...onceki, ...data.atamalar] : data.atamalar));
      setNextCursor(data.nextCursor ?? null);
      setSayaclar(data.sayaclar);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Veriler yüklenirken hata oluştu";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setDahaYukleniyor(false);
    }
  }

  // Süzgeç değişince liste baştan yüklenir (imleç sıfırlanır).
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTab, mentorFiltresi]);

  useEffect(() => {
    fetch("/api/admin/mentors")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMentorler(Array.isArray(d) ? d : []))
      .catch(() => setMentorler([]));
  }, []);

  // #257: Kurulu bir çalışma alanı artık donuk değil; yol haritası değişince
  // yeniden senkronize edilebiliyor. İşlemler idempotent olduğu için kopya
  // milestone/issue oluşmuyor.
  const [guncellenenId, setGuncellenenId] = useState<string | null>(null);

  // Kurulum artık arka planda koşuyor (uç 202 dönüyor). İlerlemeyi
  // `githubStatus` üzerinden izliyoruz: PROVISIONING olan bir atama varsa
  // listeyi düzenli tazele, hepsi bitince yoklamayı durdur.
  //
  // Sayfa yenilendiğinde de çalışır: sürmekte olan bir kurulum varsa yoklama
  // kendiliğinden başlar.
  // #483: TAKILI satır "kuruluyor" SAYILMAZ. Önceden yalnız duruma
  // bakılıyordu; süreç yeniden başladığında satır sonsuza dek PROVISIONING
  // kalıyor ve bu sayfa SONSUZA DEK yoklama isteği atıyordu.
  const kuruluyorVar = assignments.some(
    (a) => a.githubStatus === "PROVISIONING" && !a.kurulumTakildi,
  );

  useEffect(() => {
    if (!kuruluyorVar) return;

    const zamanlayici = setInterval(() => {
      // Sekme arka plandayken boşuna istek atma.
      // #452: Yüklenmiş sayfa sayısını koru — yoklama listeyi ilk sayfaya
      // düşürüp adminin açtığı kayıtları kaybetmemeli.
      if (document.visibilityState === "visible") loadData({ koru: assignments.length });
    }, 4000);

    return () => clearInterval(zamanlayici);
    // `assignments.length` bilerek bağımlılık DEĞİL: her satır eklendiğinde
    // zamanlayıcı yeniden kurulurdu. Yoklama yalnız kurulum sürerken çalışır
    // ve o sırada güncel uzunluğu okuması yeterli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuruluyorVar]);

  // #218: Admin hangi modda olduğunu ÖNCEDEN bilmeli. Aksi halde
  // "Oluşturuldu" mesajını görüp GitHub'da gerçek repo bekliyor, 404 buluyor.
  const [gercekEntegrasyon, setGercekEntegrasyon] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/admin/github-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGercekEntegrasyon(d?.gercek ?? null))
      .catch(() => setGercekEntegrasyon(null));
  }, []);

  async function handleWorkspaceGuncelle(assignmentId: string) {
    setGuncellenenId(assignmentId);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, guncelle: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Çalışma alanı güncellenemedi");
      }

      // 202: iş kabul edildi, henüz bitmedi. "Güncellendi" demek yanıltıcı olur.
      toast.success(
        data.simulated ? "Önizleme Güncellemesi Başlatıldı" : "Güncelleme Başlatıldı",
        { description: data.message },
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Güncelleme başarısız oldu";
      toast.error("Çalışma alanı güncellenemedi", { description: msg });
    } finally {
      setGuncellenenId(null);
    }
  }

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

      // #218: Simülasyonda "oluşturuldu" demek yanıltıcı olurdu.
      // Ayrıca iş artık ARKA PLANDA koşuyor: yanıt geldiğinde henüz bitmiş
      // değil, bu yüzden geçmiş zaman kullanmıyoruz. Sonuç `githubStatus`
      // üzerinden izleniyor.
      toast.success(
        data.simulated
          ? "Çalışma Alanı Önizlemesi Hazırlanıyor"
          : "GitHub Çalışma Alanı Kurulumu Başlatıldı",
        { description: data.message },
      );
      setSelectedAssignment(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Oluşturma başarısız oldu";
      toast.error("GitHub alanı oluşturulamadı", { description: msg });
    } finally {
      setIsProvisioning(false);
    }
  }

  // #452: Üçü de SUNUCUDAN — filtreye uyan TÜM atamalardan hesaplanıyor,
  // yüklenmiş sayfadan değil.
  const totalAssigned = sayaclar.toplam;
  const provisionedCount = sayaclar.kurulu;
  const avgProgress = sayaclar.ortalamaIlerleme;

  const mentorSecenekleri = mentorler
    .map((m) => ({ id: m.id, name: [m.name, m.lastName].filter(Boolean).join(" ") || m.email }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  // #452: Süzme SUNUCUDA — liste zaten süzülmüş geliyor.
  const filteredAssignments = assignments;

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
