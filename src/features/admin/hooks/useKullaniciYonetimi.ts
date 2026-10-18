import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useModalA11y } from "@/components/ui/useModalA11y";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import { BOS_SAYILAR, type KullaniciSayilari, type PanelKategorisi } from "@/features/admin/kategoriler";
import { parseProfileAnalysisApiResponse, type ProfileAnalysisData } from "@/features/ai/ui/ProfileAnalysisCard";
import type { CertificateData } from "@/features/certificate/server/certificate";
import { roleConfig, getDisplayName, type Mentor, type User } from "@/features/admin/ui/kullanici-sabitleri";

type FilterCategory = PanelKategorisi;

/**
 * Admin kullanıcı yönetimi: veri çekme, sayfalama, arama/filtre, rol ve hesap
 * eylemleri, modal durumları. Sunum `AdminDashboard` sayfasında kalır.
 */
export function useKullaniciYonetimi() {
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

  return { confirm, users, setUsers, mentors, setMentors, loading, setLoading, loadError, setLoadError, updating, setUpdating, search, setSearch, filterCategory, setFilterCategory, aramaGecikmeli, setAramaGecikmeli, nextCursor, setNextCursor, dahaYukleniyor, setDahaYukleniyor, sayilar, setSayilar, analysisModalUser, setAnalysisModalUser, analysisData, setAnalysisData, analysisLoading, setAnalysisLoading, analysisError, setAnalysisError, certModalUser, setCertModalUser, certModalData, setCertModalData, basvuruMentoru, setBasvuruMentoru, openAnalysisModal, openCertificateModal, handleSaveCertificateDetails, closeAnalysisModal, analysisModalRef, listeSorgusu, loadData, dahaYukle, sayaclariTazele, handleRoleChange, handleSetMentors, handleAccountStatus, handleDeleteUser, filteredUsers, stats };
}
