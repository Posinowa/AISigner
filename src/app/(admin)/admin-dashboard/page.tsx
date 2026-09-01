// 🧭 Admin paneli — kullanıcı/rol yönetimi, staj yaşam döngüsü, mezuniyet ve güvenli hesap silme
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { extractApiErrorMessage } from "@/lib/api-error-message";
import { MentorBasvuruModal } from "@/features/mentors/ui/MentorBasvuruModal";
import {
  Users,
  GraduationCap,
  ShieldCheck,
  UserCog,
  Search,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  X,
  Trash2,
  Award,
  RefreshCw,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useModalA11y } from "@/components/ui/useModalA11y";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  ProfileAnalysisCard,
  parseProfileAnalysisApiResponse,
  type ProfileAnalysisData,
} from "@/features/ai/ui/ProfileAnalysisCard";
import { CertificateModal } from "@/components/certificate/CertificateModal";
import {
  DogrulanmisRozet,
  dogrulandiMi,
} from "@/features/auth/ui/DogrulanmisRozet";
import { Avatar } from "@/features/profile/ui/Avatar";
import type { CertificateData } from "@/features/certificate/server/certificate";
import { ROL_ROZETI, DURUM_ROZETI } from "@/lib/ui/rol-renkleri";
import { MentorOnerisiPaneli } from "@/features/matching/ui/MentorOnerisiPaneli";

type User = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  accountStatus: "PENDING" | "APPROVED" | "REJECTED" | "GRADUATED";
  // #259: Dolu ise e-postası doğrulanmış hesap.
  emailVerified?: string | null;
  // #265: Fotoğrafı var mı — gereksiz 404 isteği atmamak için.
  avatarFile?: string | null;
  studentProfile?: {
    id: string;
    // #195: M:N — atanmış mentorlar (0..n).
    mentors: { id: string; name: string | null; lastName: string | null }[];
  } | null;
};

type Mentor = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
};

type FilterCategory =
  | "ALL"
  | "PENDING"
  | "APPROVED"
  | "GRADUATED"
  | "REJECTED"
  | "MENTOR"
  // #250: Onay bekleyen mentör başvuruları. "MENTOR" kategorisinden ayrı
  // tutuluyor; aksi halde başvuru mevcut mentörlerin arasında kaybolurdu.
  | "MENTOR_BASVURU"
  // #259: E-postasını henüz doğrulamamış hesaplar.
  | "DOGRULANMAMIS"
  | "ADMIN";

const roleConfig: Record<User["role"], { label: string; color: string }> = {
  // #338: Renkler merkezi kaynaktan — DebugNavbar ve mesajlaşma ile aynı
  // eşlemeyi paylaşıyor. Öncesi her dosya kendi tablosunu tutuyordu ve
  // birbiriyle çelişiyorlardı.
  ADMIN: { label: ROL_ROZETI.ADMIN.etiket, color: ROL_ROZETI.ADMIN.sinif },
  MENTOR: { label: ROL_ROZETI.MENTOR.etiket, color: ROL_ROZETI.MENTOR.sinif },
  STUDENT: { label: ROL_ROZETI.STUDENT.etiket, color: ROL_ROZETI.STUDENT.sinif },
};

const statusConfig: Record<
  User["accountStatus"],
  { label: string; color: string; icon: typeof Clock }
> = {
  PENDING: {
    label: "Onay Bekliyor",
    color:
      "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  APPROVED: {
    label: "Aktif Stajyer",
    color:
      "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  GRADUATED: {
    label: "Mezun / Staj Bitti",
    color:
      DURUM_ROZETI.GRADUATED,
    icon: GraduationCap,
  },
  REJECTED: {
    label: "Reddedildi",
    color:
      "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
};

export default function AdminDashboard() {
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("ALL");

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [usersRes, mentorsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/mentors"),
      ]);
      if (!usersRes.ok || !mentorsRes.ok) {
        setLoadError(true);
        return;
      }
      const usersData = await usersRes.json();
      const mentorsData = await mentorsRes.json();
      setUsers(usersData);
      setMentors(mentorsData);
    } catch (err) {
      console.error("Fetch error:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      // Kategori filtresi
      if (filterCategory === "PENDING" && (u.role !== "STUDENT" || u.accountStatus !== "PENDING")) return false;
      if (filterCategory === "APPROVED" && (u.role !== "STUDENT" || u.accountStatus !== "APPROVED")) return false;
      if (filterCategory === "GRADUATED" && (u.role !== "STUDENT" || u.accountStatus !== "GRADUATED")) return false;
      if (filterCategory === "REJECTED" && (u.role !== "STUDENT" || u.accountStatus !== "REJECTED")) return false;
      if (filterCategory === "MENTOR" && (u.role !== "MENTOR" || u.accountStatus === "PENDING")) return false;
      if (filterCategory === "MENTOR_BASVURU" && (u.role !== "MENTOR" || u.accountStatus !== "PENDING")) return false;
      if (filterCategory === "ADMIN" && u.role !== "ADMIN") return false;
      if (filterCategory === "DOGRULANMAMIS" && dogrulandiMi(u.emailVerified)) return false;

      if (!q) return true;
      const fullName = `${u.name ?? ""} ${u.lastName ?? ""}`.toLowerCase();
      return u.email.toLowerCase().includes(q) || fullName.includes(q);
    });
  }, [users, search, filterCategory]);

  const stats = useMemo(() => {
    const total = users.length;
    const studentCount = users.filter((u) => u.role === "STUDENT").length;
    const activeStudents = users.filter(
      (u) => u.role === "STUDENT" && u.accountStatus === "APPROVED",
    ).length;
    const graduatedCount = users.filter(
      (u) => u.role === "STUDENT" && u.accountStatus === "GRADUATED",
    ).length;
    const pendingCount = users.filter(
      (u) => u.role === "STUDENT" && u.accountStatus === "PENDING",
    ).length;
    const rejectedCount = users.filter(
      (u) => u.role === "STUDENT" && u.accountStatus === "REJECTED",
    ).length;
    // #250: Onay bekleyen başvuru henüz "mentör" değil — sayıdan ayrılıyor.
    const mentorCount = users.filter(
      (u) => u.role === "MENTOR" && u.accountStatus !== "PENDING",
    ).length;
    const mentorBasvuruCount = users.filter(
      (u) => u.role === "MENTOR" && u.accountStatus === "PENDING",
    ).length;
    const adminCount = users.filter((u) => u.role === "ADMIN").length;
    const dogrulanmamisCount = users.filter(
      (u) => !dogrulandiMi(u.emailVerified),
    ).length;
    const studentsWithoutMentor = users.filter(
      // #195: M:N — onaylı ama hiç mentoru olmayan öğrenciler.
      (u) =>
        u.role === "STUDENT" &&
        u.accountStatus === "APPROVED" &&
        u.studentProfile &&
        u.studentProfile.mentors.length === 0,
    ).length;

    return {
      total,
      studentCount,
      activeStudents,
      graduatedCount,
      pendingCount,
      rejectedCount,
      mentorCount,
      mentorBasvuruCount,
      adminCount,
      dogrulanmamisCount,
      studentsWithoutMentor,
    };
  }, [users]);

  const getDisplayName = (u: { name: string | null; lastName: string | null; email?: string }) => {
    const full = `${u.name ?? ""} ${u.lastName ?? ""}`.trim();
    return full || u.email?.split("@")[0] || "İsimsiz";
  };

  const getInitials = (u: {
    name: string | null;
    lastName: string | null;
    email: string;
  }) => {
    const parts = [u.name, u.lastName].filter(Boolean) as string[];
    if (parts.length > 0) return parts.map((p) => p[0].toUpperCase()).join("");
    return u.email[0]?.toUpperCase() ?? "?";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="animate-spin h-7 w-7 text-blue-600 mr-3" />
        <span className="text-slate-600 font-medium">
          Kullanıcılar yükleniyor...
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          Kullanıcılar yüklenemedi
        </h2>
        <p className="text-slate-500 text-sm mt-1 mb-5">
          Bağlantıda bir sorun oluştu. Lütfen tekrar deneyin.
        </p>
        <button
          onClick={loadData}
          className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-5 py-2.5 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

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

        {/* #250: Mentör başvurusu bekliyorsa admin bunu panele girer girmez
            görmeli; başvuru listedeki satırlardan birine gömülü kalmasın. */}
        {stats.mentorBasvuruCount > 0 && (
          <button
            onClick={() => setFilterCategory("MENTOR_BASVURU")}
            className="mb-6 w-full flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-left transition hover:border-amber-300"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <UserCog className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-amber-900">
                {stats.mentorBasvuruCount} mentör başvurusu onay bekliyor
              </span>
              <span className="block text-xs text-amber-700">
                Başvuruları görmek için tıklayın.
              </span>
            </span>
          </button>
        )}

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-8">
          {[
            {
              icon: Users,
              color: "text-blue-600 bg-blue-50",
              label: "Toplam Kullanıcı",
              value: stats.total,
              filter: "ALL" as FilterCategory,
            },
            {
              icon: Clock,
              color: "text-amber-600 bg-amber-50",
              label: "Onay Bekleyen",
              value: stats.pendingCount,
              filter: "PENDING" as FilterCategory,
            },
            {
              icon: CheckCircle2,
              color: "text-emerald-600 bg-emerald-50",
              label: "Aktif Stajyer",
              value: stats.activeStudents,
              filter: "APPROVED" as FilterCategory,
            },
            {
              icon: GraduationCap,
              color: "text-primary bg-primary/10",
              label: "Mezun / Biten",
              value: stats.graduatedCount,
              filter: "GRADUATED" as FilterCategory,
            },
            {
              icon: UserCog,
              color: "text-indigo-600 bg-indigo-50",
              label: "Mentör",
              value: stats.mentorCount,
              filter: "MENTOR" as FilterCategory,
            },
            {
              icon: ShieldCheck,
              color: "text-rose-600 bg-rose-50",
              label: "Yönetici",
              value: stats.adminCount,
              filter: "ADMIN" as FilterCategory,
            },
          ].map(({ icon: Icon, color, label, value, filter }) => (
            <button
              key={label}
              onClick={() => setFilterCategory(filter)}
              className={`text-left rounded-2xl border p-4 shadow-sm transition-all ${
                filterCategory === filter
                  ? "bg-white ring-2 ring-ring border-blue-500 shadow-md"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} mb-2.5 shrink-0`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-xs font-medium text-slate-500 truncate leading-tight">
                {label}
              </p>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                {value}
              </p>
            </button>
          ))}
        </div>

        {/* Onay bekleyen stajyerler bildirim kartı */}
        {stats.pendingCount > 0 && filterCategory === "ALL" && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-50/90 border border-amber-200 px-5 py-4">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-amber-950">
                {stats.pendingCount} stajyer onay bekliyor
              </p>
              <p className="text-amber-800 mt-0.5">
                Aşağıdaki listeden bekleyen öğrencileri onaylayabilir veya profil analizlerini inceleyerek mentör atayabilirsiniz.
              </p>
            </div>
          </div>
        )}

        {/* Uyarı banner — mentor atanmamış aktif öğrenciler */}
        {stats.studentsWithoutMentor > 0 && filterCategory === "ALL" && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-blue-50/90 border border-blue-200 px-5 py-4">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-950">
                {stats.studentsWithoutMentor} aktif öğrencinin mentoru seçilmedi
              </p>
              <p className="text-blue-800 mt-0.5">
                Onaylanmış stajyerlerinize ilgili alandaki mentörlerini aşağıdaki listeden doğrudan atayabilirsiniz.
              </p>
            </div>
          </div>
        )}

        {/* Arama & Kategori Filtreleri */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim veya e-posta ile ara..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-ring outline-none transition"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { id: "ALL" as FilterCategory, label: "Tümü" },
              { id: "PENDING" as FilterCategory, label: "Onay Bekleyenler" },
              { id: "APPROVED" as FilterCategory, label: "Aktif Stajyerler" },
              { id: "GRADUATED" as FilterCategory, label: "Mezunlar 🎓" },
              { id: "REJECTED" as FilterCategory, label: "Reddedilenler" },
              { id: "MENTOR" as FilterCategory, label: "Mentörler" },
              {
                id: "MENTOR_BASVURU" as FilterCategory,
                label: `Mentör Başvuruları${stats.mentorBasvuruCount > 0 ? ` (${stats.mentorBasvuruCount})` : ""}`,
              },
              {
                id: "DOGRULANMAMIS" as FilterCategory,
                label: `Doğrulanmamış${stats.dogrulanmamisCount > 0 ? ` (${stats.dogrulanmamisCount})` : ""}`,
              },
              { id: "ADMIN" as FilterCategory, label: "Yöneticiler" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterCategory(id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  filterCategory === id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

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

              {filteredUsers.map((user) => {
                const isUpdating = updating === user.id;
                const status = statusConfig[user.accountStatus];
                const StatusIcon = status.icon;

                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-6 py-4.5 hover:bg-slate-50/80 items-center transition-colors"
                  >
                    {/* Kullanıcı Künyesi */}
                    <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
                      {/* #265: Fotoğraf varsa gösterilir; yoksa eskisi gibi
                          baş harfler. Renkler rol/durum bilgisini taşıdığı için
                          fallback'te korunuyor. */}
                      <Avatar
                        userId={user.id}
                        basHarfler={getInitials(user)}
                        fotografVar={Boolean(user.avatarFile)}
                        ad={getDisplayName(user)}
                        arkaPlanSinifi={
                          user.accountStatus === "GRADUATED"
                            ? "bg-gradient-to-br from-primary to-[#3e92cc] ring-2 ring-primary/20"
                            : user.role === "ADMIN"
                              ? "bg-gradient-to-br from-indigo-500 to-indigo-700"
                              : user.role === "MENTOR"
                                ? "bg-gradient-to-br from-blue-500 to-cyan-600"
                                : "bg-gradient-to-br from-emerald-500 to-teal-600"
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {getDisplayName(user)}
                          </p>
                          {user.accountStatus === "GRADUATED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20">
                              <Award className="w-3 h-3" /> Mezun
                            </span>
                          )}
                          {/* #259: Doğrulama durumu künyede; admin listeye
                              bakarken hangi hesapların doğrulandığını görsün. */}
                          <DogrulanmisRozet
                            emailVerified={user.emailVerified}
                            boyut="kucuk"
                          />
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {user.email}
                        </p>
                        {/* #287: Mentörün başvuru cevapları — onay kararı
                            artık ad-soyada bakılarak verilmiyor. */}
                        {user.role === "MENTOR" && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <button
                              onClick={() => setBasvuruMentoru(user)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              <FileText className="w-3 h-3" /> Başvuruyu Gör
                            </button>
                          </div>
                        )}

                        {user.role === "STUDENT" && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${status.color}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                            {user.studentProfile && (
                              <button
                                onClick={() => openAnalysisModal(user)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition-colors"
                              >
                                <Sparkles className="w-3 h-3" /> Analizi Gör
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rol Seçici (Onay Korumalı) */}
                    <div className="lg:col-span-2 flex items-center gap-2">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user, e.target.value as User["role"])
                        }
                        disabled={isUpdating}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-ring focus:border-blue-500 disabled:opacity-50 transition"
                      >
                        <option value="ADMIN">👑 Yönetici</option>
                        <option value="MENTOR">🧑‍🏫 Mentor</option>
                        <option value="STUDENT">🎓 Öğrenci</option>
                      </select>
                    </div>

                    {/* Staj Durumu & Mentor Ataması */}
                    <div className="lg:col-span-3 flex items-center">
                      {user.role === "STUDENT" ? (
                        user.accountStatus === "GRADUATED" ? (
                          <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 w-full">
                            <GraduationCap className="w-4 h-4 shrink-0" />
                            <span className="font-semibold truncate">
                              Staj tamamlandı & mezun edildi
                            </span>
                          </div>
                        ) : user.studentProfile ? (
                          <div className="flex flex-col gap-2 w-full">
                            {/* #195: Atanmış mentorlar — chip + kaldır (x) */}
                            {user.studentProfile.mentors.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {user.studentProfile.mentors.map((m) => (
                                  <span
                                    key={m.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                  >
                                    {getDisplayName(m)}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetMentors(
                                          user.id,
                                          user.studentProfile!.mentors
                                            .filter((x) => x.id !== m.id)
                                            .map((x) => x.id),
                                        )
                                      }
                                      disabled={isUpdating}
                                      aria-label={`${getDisplayName(m)} mentörünü kaldır`}
                                      className="hover:text-red-600 disabled:opacity-60"
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* Mentor ekle — yalnız henüz atanmamış mentorları göster */}
                            <div className="flex items-center gap-2 w-full">
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleSetMentors(user.id, [
                                      ...user.studentProfile!.mentors.map((x) => x.id),
                                      e.target.value,
                                    ]);
                                  }
                                }}
                                disabled={isUpdating}
                                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:border-blue-500 disabled:opacity-60"
                              >
                                <option value="">+ Mentor ekle…</option>
                                {mentors
                                  .filter(
                                    (mentor) =>
                                      !user.studentProfile!.mentors.some((x) => x.id === mentor.id),
                                  )
                                  .map((mentor) => (
                                    <option key={mentor.id} value={mentor.id}>
                                      {getDisplayName(mentor)} ({mentor.email})
                                    </option>
                                  ))}
                              </select>
                              {isUpdating && <Loader2 className="animate-spin w-3.5 h-3.5 text-blue-600" />}
                            </div>

                            {/* #328: AI mentör önerisi. Panel ATAMA YAPMAZ —
                                "Ata" düğmesi mevcut atama akışını çağırır. */}
                            <MentorOnerisiPaneli
                              studentId={user.id}
                              ogrenciAdi={getDisplayName(user)}
                              atamaSuruyor={isUpdating}
                              onAta={(mentorId) =>
                                handleSetMentors(user.id, [
                                  ...user.studentProfile!.mentors.map((x) => x.id),
                                  mentorId,
                                ])
                              }
                            />
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-xl">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Profil kurulumu bekleniyor
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          —
                        </span>
                      )}
                    </div>

                    {/* Hızlı Aksiyonlar & Güvenli Silme Butonu */}
                    <div className="lg:col-span-3 flex items-center justify-start lg:justify-end gap-2 flex-wrap">
                      {isUpdating ? (
                        <Loader2 className="animate-spin w-4 h-4 text-blue-600 my-1" />
                      ) : (
                        <>
                          {/* #250: Mentör başvurusu. Onay butonları önceden
                              yalnızca STUDENT satırlarında vardı; admin
                              başvuruyu görebiliyor ama onaylayamıyordu.
                              "Mezun Et" mentöre uygulanmaz.
                              Reddet yalnızca bekleyen başvuruda: aktif bir
                              mentörün yetkisini almak atanmış öğrencileri
                              etkiler, o ayrı bir iş. */}
                          {user.role === "MENTOR" &&
                            (user.accountStatus === "PENDING" ||
                              user.accountStatus === "REJECTED") && (
                              <>
                                <button
                                  onClick={() =>
                                    handleAccountStatus(
                                      user,
                                      "APPROVED",
                                      `${getDisplayName(user)} adlı kişinin mentör başvurusunu onaylamak istediğinize emin misiniz?

Onaylandığında mentör paneline erişebilecek.`,
                                    )
                                  }
                                  title="Mentör Başvurusunu Onayla"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Onayla
                                </button>

                                {user.accountStatus === "PENDING" && (
                                  <button
                                    onClick={() =>
                                      handleAccountStatus(
                                        user,
                                        "REJECTED",
                                        `${getDisplayName(user)} adlı kişinin mentör başvurusunu reddetmek istediğinize emin misiniz?`,
                                      )
                                    }
                                    title="Mentör Başvurusunu Reddet"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-red-300 hover:text-red-600 text-slate-600 text-xs font-semibold shadow-sm transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Reddet
                                  </button>
                                )}
                              </>
                            )}

                          {user.role === "STUDENT" && (
                            <>
                              {/* Onay Bekleyen veya Reddedilen → Onayla */}
                              {(user.accountStatus === "PENDING" ||
                                user.accountStatus === "REJECTED") && (
                                <button
                                  onClick={() =>
                                    handleAccountStatus(
                                      user,
                                      "APPROVED",
                                      `${getDisplayName(user)} adlı öğrencinin hesabını onaylamak ve aktifleştirmek istediğinize emin misiniz?`,
                                    )
                                  }
                                  title="Stajyeri Onayla"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Onayla
                                </button>
                              )}

                              {/* Aktif Stajyer → Mezun Et */}
                              {user.accountStatus === "APPROVED" && (
                                <button
                                  onClick={() =>
                                    handleAccountStatus(
                                      user,
                                      "GRADUATED",
                                      `🎓 ${getDisplayName(user)} adlı öğrencinin staj sürecini başarıyla tamamlayıp "Mezun" durumuna geçirmek istediğinize emin misiniz?\n\nÖğrenci hesabına tekrar girdiğinde tebrik ve başarı mesajı ile karşılanacaktır.`,
                                    )
                                  }
                                  title="Stajı Bitir & Mezun Et"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary hover:bg-[#1b2a55] text-primary-foreground text-xs font-semibold shadow-sm transition-colors"
                                >
                                  <GraduationCap className="w-3.5 h-3.5" /> Mezun Et
                                </button>
                              )}

                              {/* Onay Bekleyen veya Aktif → Reddet */}
                              {(user.accountStatus === "PENDING" ||
                                user.accountStatus === "APPROVED") && (
                                <button
                                  onClick={() =>
                                    handleAccountStatus(
                                      user,
                                      "REJECTED",
                                      `${getDisplayName(user)} adlı öğrencinin başvurusunu/stajyerlik durumunu reddetmek istediğinize emin misiniz?`,
                                    )
                                  }
                                  title="Başvuruyu Reddet"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold border border-red-200 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reddet
                                </button>
                              )}

                              {/* Mezun veya Reddedilen → Tekrar Aktifleştir */}
                              {(user.accountStatus === "GRADUATED" ||
                                user.accountStatus === "REJECTED") && (
                                <button
                                  onClick={() =>
                                    handleAccountStatus(
                                      user,
                                      "APPROVED",
                                      `${getDisplayName(user)} adlı öğrencinin staj hesabını yeniden "Aktif Stajyer" durumuna getirmek istediğinize emin misiniz?`,
                                    )
                                  }
                                  title="Yeniden Aktifleştir"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" /> Aktifleştir
                                </button>
                              )}

                              {/* Sertifika ve Mentör Referans Notu Yönetimi */}
                              {user.studentProfile && (
                                <button
                                  onClick={() => openCertificateModal(user)}
                                  title="Sertifika & Mentör Notu Yönetimi"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors"
                                >
                                  <Award className="w-3.5 h-3.5" /> Sertifika & Not
                                </button>
                              )}
                            </>
                          )}

                          {/* Kalıcı Hesap Silme Butonu (Tüm roller için - admin kendini silemez) */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            title="Hesabı Kalıcı Olarak Sil"
                            className="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            ref={analysisModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="AI Profil Analizi"
            tabIndex={-1}
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto outline-none border border-slate-200"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  AI Profil Analizi
                </h2>
                <p className="text-xs text-slate-500">
                  {getDisplayName(analysisModalUser)} ({analysisModalUser.email})
                </p>
              </div>
              <button
                onClick={closeAnalysisModal}
                aria-label="Kapat"
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <ProfileAnalysisCard
                analysis={analysisData}
                loading={analysisLoading}
                error={analysisError}
              />
            </div>
          </div>
        </div>
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
