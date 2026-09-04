"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GitBranch,
  Clock,
  AlertTriangle,
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
import { tarihSaatBicimle } from "@/lib/tarih";

export type StudentAssignmentProgress = {
  assignmentId: string;
  studentId: string;
  studentName: string;
  // #332/#367: Takım atamasında tek bir öğrenci yok.
  studentEmail: string | null;
  experienceLevel: string | null;
  teamId: string | null;
  teamMembers: { name: string; role: string }[];
  // #195: M:N — atanmış mentorlar (0..n).
  mentors: { id: string; name: string }[];
  projectTemplateId: string;
  projectTitle: string;
  projectDifficulty: string;
  assignmentStatus: string;
  githubRepoUrl: string | null;
  githubStatus: string;
  provisionedAt: Date | null;
  /**
   * #483: kurulum yarıda kalmış (süreç yeniden başlamış). Eşik SUNUCUDA
   * hesaplanıyor — burada tekrar yazmak kilitteki eşikle ayrışırdı.
   *
   * ⚠️ Bu tip sunucudaki `StudentAssignmentProgress`in ELLE TUTULAN
   * kopyası. Alanı orada ekleyip burada unutmak derleme hatası verdi;
   * ikisini bir arada tutan tek şey şu an tsc.
   */
  kurulumTakildi: boolean;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  /** #432: Durakladıysa "10 gündür hareket yok", aksi halde null. */
  duraklamaMetni: string | null;
  lastActivity: {
    title: string;
    updatedAt: Date;
  } | null;
  roadmapId: string | null;
  roadmapStatus: string | null;
};

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
                            onClick={() => handleWorkspaceGuncelle(item.assignmentId)}
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
                          onClick={() => setSelectedAssignment(item)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
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

            <div className="space-y-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div>
                <span className="font-semibold text-slate-900">Hedef Organizasyon:</span>{" "}
                <span className="text-indigo-600 font-bold">Posinowa</span> (github.com/Posinowa)
              </div>
              <div>
                <span className="font-semibold text-slate-900">Hedef Repo:</span>{" "}
                <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">
                  Posinowa/aisigner-{(selectedAssignment.studentName || "student").toLowerCase().replace(/[^a-z0-9]/g, "")}-{(selectedAssignment.projectTitle || "project").toLowerCase().replace(/[^a-z0-9]/g, "-")}
                </code>
              </div>
              <div>
                <span className="font-semibold text-slate-900">Öğrenci:</span>{" "}
                {selectedAssignment.studentName} ({selectedAssignment.experienceLevel})
              </div>
              <div>
                <span className="font-semibold text-slate-900">Proje:</span>{" "}
                {selectedAssignment.projectTitle}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Oluşturulacak Faz Sayısı (Milestone):</span>{" "}
                {selectedAssignment.totalSteps} Faz
              </div>
              <div>
                <span className="font-semibold text-slate-900">Tahmini Açılacak Issue Sayısı:</span>{" "}
                ~{selectedAssignment.totalSteps * 3} AI Detaylı Issue
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Bu akış, <strong className="text-slate-700">Posinowa</strong> organizasyonu için öğrenciye özel repo, faz (Milestone) ve AI ile detaylandırılmış görev (Issue) yapısını hazırlar.
            </p>

            {/* #178-1: Bu özellik şu an ÖNİZLEME/simülasyondur — dürüstçe belirtilir. */}
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
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
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleConfirmProvision}
                disabled={isProvisioning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition disabled:opacity-50"
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
