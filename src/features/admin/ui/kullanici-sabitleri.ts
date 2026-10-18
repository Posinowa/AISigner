import { CheckCircle2, Clock, GraduationCap, XCircle } from "lucide-react";
import { ROL_ROZETI, DURUM_ROZETI } from "@/lib/ui/rol-renkleri";

/** Admin panelinin kullanıcı satırı tipi (API `users` öğesi). */
export type User = {
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

export type Mentor = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  /** #404: Açılır listede yük görünsün diye. */
  aktifOgrenci: number;
  kapasite: number | null;
};

export const roleConfig: Record<User["role"], { label: string; color: string }> = {
  // #338: Renkler merkezi kaynaktan — DebugNavbar ve mesajlaşma ile aynı
  // eşlemeyi paylaşıyor. Öncesi her dosya kendi tablosunu tutuyordu ve
  // birbiriyle çelişiyorlardı.
  ADMIN: { label: ROL_ROZETI.ADMIN.etiket, color: ROL_ROZETI.ADMIN.sinif },
  MENTOR: { label: ROL_ROZETI.MENTOR.etiket, color: ROL_ROZETI.MENTOR.sinif },
  STUDENT: { label: ROL_ROZETI.STUDENT.etiket, color: ROL_ROZETI.STUDENT.sinif },
};

export const statusConfig: Record<
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

export function getDisplayName(u: { name: string | null; lastName: string | null; email?: string }) {
  const full = `${u.name ?? ""} ${u.lastName ?? ""}`.trim();
  return full || u.email?.split("@")[0] || "İsimsiz";
}

export function getInitials(u: {
  name: string | null;
  lastName: string | null;
  email: string;
}) {
  const parts = [u.name, u.lastName].filter(Boolean) as string[];
  if (parts.length > 0) return parts.map((p) => p[0].toUpperCase()).join("");
  return u.email[0]?.toUpperCase() ?? "?";
}
