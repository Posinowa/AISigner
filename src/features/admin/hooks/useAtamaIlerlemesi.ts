"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import type { StudentAssignmentProgress } from "@/features/admin/ui/atama-tipleri";

/** #452: Sunucudan gelen sayaçlar. Sunucu modülünü import etmiyoruz —
    `assignment-progress.ts` prisma çekiyor ve istemci paketine sızardı. */
type AtamaSayaclari = {
  toplam: number;
  kurulu: number;
  kurulmamis: number;
  ortalamaIlerleme: number;
};

/** useAtamaIlerlemesi: sayfanın durum ve eylemleri (sunum sayfada). */
export function useAtamaIlerlemesi() {
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

  return { assignments, setAssignments, isLoading, setIsLoading, error, setError, filterTab, setFilterTab, mentorFiltresi, setMentorFiltresi, nextCursor, setNextCursor, dahaYukleniyor, setDahaYukleniyor, sayaclar, setSayaclar, mentorler, setMentorler, selectedAssignment, setSelectedAssignment, isProvisioning, setIsProvisioning, loadData, guncellenenId, setGuncellenenId, kuruluyorVar, gercekEntegrasyon, setGercekEntegrasyon, handleWorkspaceGuncelle, handleConfirmProvision, totalAssigned, provisionedCount, avgProgress, mentorSecenekleri, filteredAssignments };
}
