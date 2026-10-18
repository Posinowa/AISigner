// 🧭 Admin paneli — kullanıcı/rol yönetimi, staj yaşam döngüsü, mezuniyet ve güvenli hesap silme
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BOS_SAYILAR,
  type KullaniciSayilari,
  type PanelKategorisi,
} from "@/features/admin/kategoriler";
import { IstatistikKartlari } from "@/features/admin/ui/IstatistikKartlari";
import { AramaVeKategoriler } from "@/features/admin/ui/AramaVeKategoriler";
import { KullaniciSatiri } from "@/features/admin/ui/KullaniciSatiri";
import { AnalizModali } from "@/features/admin/ui/AnalizModali";
import {
  getDisplayName,
  roleConfig,
  type Mentor,
  type User,
} from "@/features/admin/ui/kullanici-sabitleri";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import { MentorBasvuruModal } from "@/features/mentors/ui/MentorBasvuruModal";
import { Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { YuklemeEkrani, HataEkrani } from "@/features/admin/ui/AdminDurumEkranlari";
import { MentorBasvuruUyarisi, AdminBildirimleri } from "@/features/admin/ui/AdminUyarilari";
import { useModalA11y } from "@/components/ui/useModalA11y";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  parseProfileAnalysisApiResponse,
  type ProfileAnalysisData,
} from "@/features/ai/ui/ProfileAnalysisCard";
import { CertificateModal } from "@/components/certificate/CertificateModal";
import type { CertificateData } from "@/features/certificate/server/certificate";

// Kategori listesi TEK KAYNAKTA (`admin/kategoriler.ts`): `PanelKategorisi`
// onu "STUDENT" hariç türetiyor; yeni kategori otomatik yansıyor (#489).
type FilterCategory = PanelKategorisi;

export default function AdminDashboard() {
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("ALL");
  /*
   * Sayfalama durumu.
   *
   * ⚠️ ARAMA VE FİLTRE ARTIK SUNUCUDA. İstemcide süzmek, yalnız YÜKLÜ
   * SAYFAYI tarardı: admin var olan bir kaydı arayıp "sonuç yok" görürdü.
   * `search` bu yüzden geciktirilerek (debounce) sunucuya gidiyor.
   */
  const [aramaGecikmeli, setAramaGecikmeli] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false);
  /*
   * ⚠️ SAYAÇLAR SUNUCUDAN. Önceden yüklü listeden `.filter().length` ile
   * hesaplanıyordu; sayfalamayla o yaklaşım "ilk 50 kayıttaki mentör
   * sayısı"nı gösterirdi ve bu HATA OLARAK GÖRÜNMEZDİ, yalnız sayılar
   * düşük çıkardı.
   */
  const [sayilar, setSayilar] = useState<KullaniciSayilari | null>(null);

  // Analiz modal'ı — hangi öğrenci için açık, veri/loading/error durumu (lazy fetch).
  const [analysisModalUser, setAnalysisModalUser] = useState<User | null>(null);
  const [analysisData, setAnalysisData] = useState<ProfileAnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Sertifika & Referans modal'ı
  const [certModalUser, setCertModalUser] = useState<User | null>(null);
  const [certModalData, setCertModalData] = useState<CertificateData | null>(null);

  // #287: Admin, mentörün başvuru cevaplarını buradan okuyor. Önceden onay
  // kararı yalnızca ad-soyada bakılarak veriliyordu.
  const [basvuruMentoru, setBasvuruMentoru] = useState<User | null>(null);

  async function openAnalysisModal(user: User) {
    setAnalysisModalUser(user);
    setAnalysisData(null);
    setAnalysisError(null);
    setAnalysisLoading(true);
    try {
      const res = await fetch(`/api/admin/students/${user.id}/profile-analysis`);
      const body = await res.json().catch(() => null);
      const { analysis, error } = parseProfileAnalysisApiResponse(res.ok, body);
      setAnalysisData(analysis);
      setAnalysisError(error);
    } catch {
      setAnalysisError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function openCertificateModal(user: User) {
    setCertModalUser(user);
    setCertModalData(null);
    try {
      const res = await fetch(`/api/admin/students/${user.id}/certificate`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.certificate) {
        setCertModalData(data.certificate);
      } else {
        toast.error(data?.error || "Sertifika verisi alınamadı.");
        setCertModalUser(null);
      }
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
      setCertModalUser(null);
    }
  }

  async function handleSaveCertificateDetails(details: {
    mentorNote: string;
    completionGrade: string;
  }) {
    if (!certModalUser) return;
    const res = await fetch(`/api/admin/students/${certModalUser.id}/certificate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Kayıt başarısız.");
    }
  }

  function closeAnalysisModal() {
    setAnalysisModalUser(null);
  }

  // Modal a11y: Escape ile kapat + açılışta panele odak.
  const analysisModalRef = useModalA11y(!!analysisModalUser, closeAnalysisModal);

  /** Liste sorgusunun adres parçası — tek yerde kurulsun. */
  const listeSorgusu = useCallback(
    (imlec?: string | null) => {
      const p = new URLSearchParams({ kategori: filterCategory });
      if (aramaGecikmeli.trim()) p.set("q", aramaGecikmeli.trim());
      if (imlec) p.set("cursor", imlec);
      return `/api/admin/users?${p.toString()}`;
    },
    [filterCategory, aramaGecikmeli],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [usersRes, mentorsRes] = await Promise.all([
        fetch(listeSorgusu()),
        fetch("/api/admin/mentors"),
      ]);
      if (!usersRes.ok || !mentorsRes.ok) {
        setLoadError(true);
        return;
      }
      const usersData = await usersRes.json();
      const mentorsData = await mentorsRes.json();
      setUsers(usersData.users ?? []);
      setNextCursor(usersData.nextCursor ?? null);
      // Sayaçlar yalnız imleçsiz (ilk) istekte dönüyor.
      if (usersData.sayilar) setSayilar(usersData.sayilar);
      setMentors(mentorsData);
    } catch (err) {
      console.error("Fetch error:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [listeSorgusu]);

  /** "Daha fazla yükle" — mevcut listenin ÜSTÜNE ekler, sıfırlamaz. */
  const dahaYukle = useCallback(async () => {
    if (!nextCursor || dahaYukleniyor) return;
    setDahaYukleniyor(true);
    try {
      const res = await fetch(listeSorgusu(nextCursor));
      if (!res.ok) return;
      const veri = await res.json();
      setUsers((prev) => [...prev, ...(veri.users ?? [])]);
      setNextCursor(veri.nextCursor ?? null);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setDahaYukleniyor(false);
    }
  }, [nextCursor, dahaYukleniyor, listeSorgusu]);

  /*
   * Sayaçları tazele.
   *
   * Rol/durum değişikliği ve silme satırı YERİNDE güncelliyor (anında geri
   * bildirim, yüklenmiş sayfalar korunuyor) — ama o satırın hangi sayaca
   * ait olduğu değişmiş olabiliyor. Tüm listeyi yeniden çekmek yüklü
   * sayfaları sıfırlardı; `limit=1` ile yalnız sayaç bloğu alınıyor.
   */
  const sayaclariTazele = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users?limit=1");
      if (!res.ok) return;
      const veri = await res.json();
      if (veri.sayilar) setSayilar(veri.sayilar);
    } catch {
      // Sayaç tazeleme sessiz: asıl işlem başarılı oldu, kullanıcıya
      // ikinci bir hata göstermek yanıltıcı olurdu.
    }
  }, []);

  /*
   * Arama girdisini geciktir — her tuş vuruşu bir sorgu açmasın.
   * 300 ms: yazarken beklemeyi hissettirmeyen, sorguyu da katlamayan aralık.
   */
  useEffect(() => {
    const t = setTimeout(() => setAramaGecikmeli(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Filtre ya da (geciktirilmiş) arama değişince liste BAŞTAN yüklenir:
  // imleç eski sorguya ait, taşımak karışık sayfa üretirdi.
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Güvenli rol değiştirme (onay koruması)
  async function handleRoleChange(user: User, newRole: User["role"]) {
    if (user.role === newRole) return;

    const confirmed = await confirm({
      title: "Kullanıcı Rolünü Değiştir",
      description: `${getDisplayName(user)} adlı kullanıcının rolünü "${roleConfig[newRole].label}" olarak değiştirmek istediğinize emin misiniz? Değişiklik kaydedilecektir.`,
      confirmLabel: "Değişikliği Kaydet",
      cancelLabel: "Vazgeç",
    });

    if (!confirmed) return;

    setUpdating(user.id);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: newRole }),
      });
      if (response.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)),
        );
        // Satır YERİNDE güncellendi (anında geri bildirim, yüklü sayfalar
        // korunuyor) ama satırın ait olduğu sayaç değişmiş olabilir.
        sayaclariTazele();
        toast.success("Rol başarıyla güncellendi.");
      } else {
        const data = await response.json().catch(() => null);
        toast.error(extractApiErrorMessage(data, "Rol güncellenemedi."));
      }
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setUpdating(null);
    }
  }

  // #195: Öğrencinin mentor LİSTESİNİ ayarla (M:N). mentorIds = olması gereken tam küme.
  async function handleSetMentors(studentId: string, mentorIds: string[]) {
    setUpdating(studentId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, mentorIds }),
      });
      if (response.ok) {
        // Seçili id'leri mentor nesnelerine çevirip yerel state'i güncelle.
        const newMentors = mentorIds
          .map((id) => mentors.find((m) => m.id === id))
          .filter((m): m is Mentor => Boolean(m))
          .map((m) => ({ id: m.id, name: m.name, lastName: m.lastName }));
        setUsers((prev) =>
          prev.map((u) =>
            u.id === studentId && u.studentProfile
              ? { ...u, studentProfile: { ...u.studentProfile, mentors: newMentors } }
              : u,
          ),
        );
        // `studentsWithoutMentor` sayacı bu işlemle değişiyor.
        sayaclariTazele();
        toast.success("Mentor atamaları güncellendi.");
      } else {
        const data = await response.json().catch(() => null);
        toast.error(extractApiErrorMessage(data, "Mentor atanamadı."));
      }
    } catch (error) {
      console.error("Error assigning mentor:", error);
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setUpdating(null);
    }
  }

  // Hesap onay durumu güncelleme (Onayla / Reddet / Mezun Et / Aktifleştir)
  async function handleAccountStatus(
    user: User,
    accountStatus: User["accountStatus"],
    customConfirmText?: string,
  ) {
    if (customConfirmText) {
      const confirmed = await confirm({
        title:
          accountStatus === "GRADUATED"
            ? "Stajı Tamamla & Mezun Et"
            : accountStatus === "REJECTED"
              ? "Başvuruyu Reddet"
              : "Hesap Durumunu Güncelle",
        description: customConfirmText,
        confirmLabel:
          accountStatus === "GRADUATED"
            ? "Mezun Et ve Kaydet"
            : accountStatus === "REJECTED"
              ? "Reddet"
              : "Onayla ve Kaydet",
        danger: accountStatus === "REJECTED",
      });

      if (!confirmed) return;
    }

    setUpdating(user.id);
    try {
      const response = await fetch("/api/admin/users/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, accountStatus }),
      });
      if (response.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, accountStatus } : u)),
        );
        // Satır YERİNDE güncellendi (anında geri bildirim, yüklü sayfalar
        // korunuyor) ama satırın ait olduğu sayaç değişmiş olabilir.
        sayaclariTazele();

        toast.success(
          accountStatus === "GRADUATED"
            ? "Staj başarıyla tamamlandı ve öğrenci mezun edildi."
            : accountStatus === "APPROVED"
              ? "Stajyer onaylandı ve aktifleştirildi."
              : accountStatus === "REJECTED"
                ? "Stajyer başvurusu reddedildi."
                : "Hesap durumu güncellendi.",
        );
      } else {
        const data = await response.json().catch(() => null);
        toast.error(extractApiErrorMessage(data, "Durum güncellenemedi."));
      }
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setUpdating(null);
    }
  }

  // Güvenli kalıcı hesap silme
  async function handleDeleteUser(user: User) {
    const confirmed = await confirm({
      title: "Hesabı Kalıcı Olarak Sil",
      description: `"${getDisplayName(user)}" (${user.email}) kullanıcısını ve bu hesaba ait tüm staj, profil, mesajlaşma ve dosya verilerini kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`,
      confirmLabel: "Kalıcı Olarak Sil",
      cancelLabel: "İptal",
      danger: true,
    });

    if (!confirmed) return;

    setUpdating(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        // Satır YERİNDE güncellendi (anında geri bildirim, yüklü sayfalar
        // korunuyor) ama satırın ait olduğu sayaç değişmiş olabilir.
        sayaclariTazele();
        toast.success("Kullanıcı hesabı ve ilişkili tüm veriler kalıcı olarak silindi.");
      } else {
        const data = await response.json().catch(() => null);
        toast.error(extractApiErrorMessage(data, "Kullanıcı silinemedi."));
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setUpdating(null);
    }
  }

  /*
   * ⚠️ İSTEMCİ FİLTRESİ KALDIRILDI — sunucu zaten süzülmüş liste dönüyor.
   *
   * Burada ikinci bir kez süzmek, sayfalamayla birlikte SESSİZ bir hataya
   * dönerdi: sunucu doğru sayfayı gönderir, istemci onu bir daha eleyip
   * eksik gösterirdi. Kategori tanımı artık `features/admin/kategoriler.ts`
   * içinde TEK kaynakta ve sayaçlar da oradan türüyor.
   */
  const filteredUsers = users;

  /*
   * Sayaçlar SUNUCUDAN (`kullaniciSayilari`) — toplama veritabanında
   * (#313 dersi). İlk yükleme bitene kadar sıfır gösteriliyor; boş kart
   * yerine yanlış bir sayı göstermek daha kötü olurdu.
   */
  const stats = sayilar ?? BOS_SAYILAR;


  if (loading) return <YuklemeEkrani />;
  if (loadError) return <HataEkrani onTekrarDene={loadData} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Sayfa Başlığı */}
        <div className="mb-8 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Yönetici Paneli
            </h1>
            <p className="text-slate-500 mt-1.5 text-sm">
              Staj yaşam döngüsünü yönet, öğrencileri onayla/mezun et ve kullanıcı hesaplarını düzenle
            </p>
          </div>
          <a
            href="/admin-dashboard/assignments"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 transition self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4" />
            Öğrenci İlerlemeleri & GitHub Yönetimi
          </a>
        </div>

        <MentorBasvuruUyarisi stats={stats} setFilterCategory={setFilterCategory} />

        {/* İstatistik Kartları — #489: sunum `IstatistikKartlari`'ne taşındı. */}
        <IstatistikKartlari
          sayilar={stats}
          aktifKategori={filterCategory}
          onKategori={setFilterCategory}
        />

        <AdminBildirimleri stats={stats} filterCategory={filterCategory} />

        {/* Arama & Kategori Filtreleri — #489: `AramaVeKategoriler`. */}
        <AramaVeKategoriler
          arama={search}
          onArama={setSearch}
          sayilar={stats}
          aktifKategori={filterCategory}
          onKategori={setFilterCategory}
        />

        {/* Kullanıcı Tablosu / Listesi */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm font-medium">
                {search || filterCategory !== "ALL"
                  ? "Filtreyle eşleşen kullanıcı kaydı bulunamadı."
                  : "Henüz kayıtlı kullanıcı bulunmuyor."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Başlık satırı (Masaüstü) */}
              <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <div className="col-span-4">Kullanıcı Bilgileri</div>
                <div className="col-span-2">Rol & Yetki</div>
                <div className="col-span-3">Staj Durumu / Mentor</div>
                <div className="col-span-3 text-right">Hızlı Eylemler & Silme</div>
              </div>

              {filteredUsers.map((user) => (
                <KullaniciSatiri
                  key={user.id}
                  user={user}
                  mentors={mentors}
                  isUpdating={updating === user.id}
                  onRolDegistir={handleRoleChange}
                  onMentorlariAyarla={handleSetMentors}
                  onHesapDurumu={handleAccountStatus}
                  onSil={handleDeleteUser}
                  onBasvuruGor={(u) => setBasvuruMentoru(u)}
                  onAnalizGor={openAnalysisModal}
                  onSertifika={openCertificateModal}
                />
              ))}

              {/*
                Sayfalama — "daha fazla yükle".
                Sonsuz kaydırma YAPILMADI: tablo satırları eylem düğmeleri
                taşıyor ve admin çoğu zaman ARIYOR, listeyi gezmiyor. Açık
                bir düğme kaç kaydın yüklü olduğunu da görünür kılıyor.
              */}
              {nextCursor && (
                <div className="px-6 py-4 flex items-center justify-center gap-3 bg-slate-50/50">
                  <span className="text-xs text-slate-500">
                    {filteredUsers.length} kayıt yüklendi
                  </span>
                  <button
                    onClick={dahaYukle}
                    disabled={dahaYukleniyor}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {dahaYukleniyor ? "Yükleniyor…" : "Daha fazla yükle"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin — Detaylı AI Profil Analizi Modal'ı (lazy fetch) */}
      {basvuruMentoru && (
        <MentorBasvuruModal
          mentorId={basvuruMentoru.id}
          mentorAdi={[basvuruMentoru.name, basvuruMentoru.lastName].filter(Boolean).join(" ") || basvuruMentoru.email}
          onClose={() => setBasvuruMentoru(null)}
        />
      )}
      {analysisModalUser && (
        <AnalizModali
          kullanici={analysisModalUser}
          dialogRef={analysisModalRef}
          analysis={analysisData}
          loading={analysisLoading}
          error={analysisError}
          onKapat={closeAnalysisModal}
        />
      )}

      {/* Admin — Sertifika & Referans Notu Modal'ı */}
      {certModalData && certModalUser && (
        <CertificateModal
          certificate={certModalData}
          isOpen={!!certModalUser}
          onClose={() => {
            setCertModalUser(null);
            setCertModalData(null);
          }}
          isAdmin={true}
          onSave={handleSaveCertificateDetails}
        />
      )}
    </div>
  );
}
