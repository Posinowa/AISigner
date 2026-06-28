// 🧭 Admin paneli — kullanıcı/rol yönetimi ve mentor atama
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  ShieldCheck,
  UserCog,
  Search,
  AlertCircle,
  Loader2,
  FolderKanban,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import LogoutButton from "@/components/LogoutButton";
import { UnreadBadge } from "@/features/messaging/ui/UnreadBadge";

type User = {
  id: string;
  email: string;
  name: string | null;
  lastName: string | null;
  role: "ADMIN" | "MENTOR" | "STUDENT";
  accountStatus: "PENDING" | "APPROVED" | "REJECTED";
  studentProfile?: {
    id: string;
    mentorId?: string | null;
  } | null;
};

type Mentor = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
};

const roleConfig: Record<User["role"], { label: string; color: string }> = {
  ADMIN: { label: "Yönetici", color: "bg-purple-50 text-purple-700 border-purple-200" },
  MENTOR: { label: "Mentor", color: "bg-blue-50 text-blue-700 border-blue-200" },
  STUDENT: { label: "Öğrenci", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const statusConfig: Record<User["accountStatus"], { label: string; color: string }> = {
  PENDING: { label: "Onay Bekliyor", color: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Onaylı", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Reddedildi", color: "bg-red-50 text-red-700 border-red-200" },
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | User["role"]>("ALL");

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, mentorsRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/mentors"),
        ]);
        const usersData = usersRes.ok ? await usersRes.json() : [];
        const mentorsData = mentorsRes.ok ? await mentorsRes.json() : [];
        setUsers(usersData);
        setMentors(mentorsData);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleRoleChange(userId: string, role: User["role"]) {
    setUpdating(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (response.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      }
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      setUpdating(null);
    }
  }

  async function handleAssignMentor(studentId: string, mentorId: string) {
    setUpdating(studentId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          mentorId: mentorId === "" ? null : mentorId,
        }),
      });
      if (response.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === studentId && u.studentProfile
              ? {
                  ...u,
                  studentProfile: {
                    ...u.studentProfile,
                    mentorId: mentorId === "" ? null : mentorId,
                  },
                }
              : u,
          ),
        );
        toast.success(mentorId === "" ? "Mentor ataması kaldırıldı." : "Mentor atandı.");
      } else {
        // #43: Geçersiz rol gibi 4xx hatalarında anlamlı mesajı göster.
        const data = await response.json().catch(() => null);
        const msg =
          data && typeof data.error === "string" ? data.error : "Mentor atanamadı.";
        toast.error(msg);
      }
    } catch (error) {
      console.error("Error assigning mentor:", error);
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setUpdating(null);
    }
  }

  async function handleAccountStatus(userId: string, accountStatus: User["accountStatus"]) {
    setUpdating(userId);
    try {
      const response = await fetch("/api/admin/users/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, accountStatus }),
      });
      if (response.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, accountStatus } : u)),
        );
        toast.success(
          accountStatus === "APPROVED"
            ? "Stajyer onaylandı."
            : accountStatus === "REJECTED"
              ? "Stajyer reddedildi."
              : "Durum güncellendi.",
        );
      } else {
        const data = await response.json().catch(() => null);
        const msg =
          data && typeof data.error === "string" ? data.error : "Durum güncellenemedi.";
        toast.error(msg);
      }
    } catch {
      toast.error("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setUpdating(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      const fullName = `${u.name ?? ""} ${u.lastName ?? ""}`.toLowerCase();
      return u.email.toLowerCase().includes(q) || fullName.includes(q);
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const studentCount = users.filter((u) => u.role === "STUDENT").length;
    const mentorCount = users.filter((u) => u.role === "MENTOR").length;
    const adminCount = users.filter((u) => u.role === "ADMIN").length;
    const studentsWithProfile = users.filter(
      (u) => u.role === "STUDENT" && u.studentProfile,
    ).length;
    const studentsWithoutMentor = users.filter(
      (u) => u.role === "STUDENT" && u.studentProfile && !u.studentProfile.mentorId,
    ).length;
    const pendingCount = users.filter(
      (u) => u.role === "STUDENT" && u.accountStatus === "PENDING",
    ).length;
    return { total, studentCount, mentorCount, adminCount, studentsWithProfile, studentsWithoutMentor, pendingCount };
  }, [users]);

  const getDisplayName = (u: { name: string | null; lastName: string | null; email: string }) => {
    const full = `${u.name ?? ""} ${u.lastName ?? ""}`.trim();
    return full || u.email.split("@")[0];
  };

  const getInitials = (u: { name: string | null; lastName: string | null; email: string }) => {
    const parts = [u.name, u.lastName].filter(Boolean) as string[];
    if (parts.length > 0) return parts.map((p) => p[0].toUpperCase()).join("");
    return u.email[0]?.toUpperCase() ?? "?";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="animate-spin h-7 w-7 text-blue-600 mr-3" />
        <span className="text-slate-600 font-medium">Kullanıcılar yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pt-2 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Yönetici Paneli</h1>
            <p className="text-slate-500 mt-1.5 text-sm">
              Kullanıcı rollerini düzenle ve öğrencilere mentor ata
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/admin-dashboard/messages"
              className="relative inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-blue-50 text-blue-700 rounded-xl text-sm font-medium transition-colors border border-blue-100 shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              Mesajlar
              <UnreadBadge />
            </Link>
            <Link
              href="/admin-dashboard/projects"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium transition-colors border border-slate-200 shadow-sm"
            >
              <FolderKanban className="w-4 h-4" />
              Proje Şablonları
            </Link>
            <LogoutButton />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, color: "text-blue-600 bg-blue-50", label: "Toplam Kullanıcı", value: stats.total },
            { icon: GraduationCap, color: "text-emerald-600 bg-emerald-50", label: "Öğrenci", value: stats.studentCount },
            { icon: UserCog, color: "text-indigo-600 bg-indigo-50", label: "Mentor", value: stats.mentorCount },
            { icon: ShieldCheck, color: "text-purple-600 bg-purple-50", label: "Yönetici", value: stats.adminCount },
          ].map(({ icon: Icon, color, label, value }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 leading-tight">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Onay bekleyen stajyerler */}
        {stats.pendingCount > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-blue-50 border border-blue-200 px-5 py-4">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900">
                {stats.pendingCount} stajyer onay bekliyor
              </p>
              <p className="text-blue-700 mt-0.5">
                Aşağıdaki listeden onay bekleyen stajyerleri onaylayabilir veya reddedebilirsin.
              </p>
            </div>
          </div>
        )}

        {/* Uyarı banner — mentor atanmamış öğrenciler */}
        {stats.studentsWithoutMentor > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">
                {stats.studentsWithoutMentor} öğrencinin mentoru yok
              </p>
              <p className="text-amber-700 mt-0.5">
                Profilini tamamlamış ancak henüz mentor atanmamış öğrenciler var. Aşağıdaki listeden atama yapabilirsin.
              </p>
            </div>
          </div>
        )}

        {/* Search + Filter */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="İsim veya e-posta ile ara..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-100 outline-none transition"
            />
          </div>
          <div className="flex gap-1.5">
            {(["ALL", "STUDENT", "MENTOR", "ADMIN"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  roleFilter === r
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {r === "ALL" ? "Tümü" : roleConfig[r].label}
              </button>
            ))}
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 text-sm font-medium">
                {search || roleFilter !== "ALL"
                  ? "Filtreyle eşleşen kullanıcı yok"
                  : "Henüz kullanıcı yok"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Header row (desktop) */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <div className="col-span-4">Kullanıcı</div>
                <div className="col-span-3">Rol</div>
                <div className="col-span-5">Onay / Mentor</div>
              </div>

              {filteredUsers.map((user) => {
                const isUpdating = updating === user.id;
                const role = roleConfig[user.role];
                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Kullanıcı */}
                    <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-sm flex items-center justify-center shrink-0 shadow-sm">
                        {getInitials(user)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {getDisplayName(user)}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        {user.role === "STUDENT" && (
                          <span
                            className={`mt-1 inline-flex w-fit items-center px-1.5 py-0.5 text-[10px] font-semibold rounded border ${statusConfig[user.accountStatus].color}`}
                          >
                            {statusConfig[user.accountStatus].label}
                          </span>
                        )}
                      </div>
                      <span
                        className={`md:hidden shrink-0 px-2 py-1 text-[10px] font-semibold rounded-lg border ${role.color}`}
                      >
                        {role.label}
                      </span>
                    </div>

                    {/* Rol */}
                    <div className="md:col-span-3 flex items-center gap-2">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as User["role"])
                        }
                        disabled={isUpdating}
                        className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                      >
                        <option value="ADMIN">Yönetici</option>
                        <option value="MENTOR">Mentor</option>
                        <option value="STUDENT">Öğrenci</option>
                      </select>
                      {isUpdating && <Loader2 className="animate-spin w-3.5 h-3.5 text-blue-600" />}
                    </div>

                    {/* Onay / Mentor Atama */}
                    <div className="md:col-span-5 flex items-center">
                      {user.role === "STUDENT" ? (
                        user.accountStatus !== "APPROVED" ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleAccountStatus(user.id, "APPROVED")}
                              disabled={isUpdating}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Onayla
                            </button>
                            {user.accountStatus === "PENDING" && (
                              <button
                                onClick={() => handleAccountStatus(user.id, "REJECTED")}
                                disabled={isUpdating}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors disabled:opacity-60"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reddet
                              </button>
                            )}
                            {isUpdating && <Loader2 className="animate-spin w-3.5 h-3.5 text-blue-600" />}
                          </div>
                        ) : user.studentProfile ? (
                          <div className="flex items-center gap-2 w-full">
                            <select
                              value={user.studentProfile.mentorId || ""}
                              onChange={(e) => handleAssignMentor(user.id, e.target.value)}
                              disabled={isUpdating}
                              className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                            >
                              <option value="">— Mentor seçilmedi —</option>
                              {mentors.map((mentor) => (
                                <option key={mentor.id} value={mentor.id}>
                                  {getDisplayName(mentor)} ({mentor.email})
                                </option>
                              ))}
                            </select>
                            {isUpdating && <Loader2 className="animate-spin w-3.5 h-3.5 text-blue-600" />}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                            <AlertCircle className="w-3 h-3" />
                            Profil tamamlanmamış
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-xs italic">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
