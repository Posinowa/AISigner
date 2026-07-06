"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { UnreadBadge } from "@/features/messaging/ui/UnreadBadge";

type Role = "ADMIN" | "MENTOR" | "STUDENT";
type NavLink = { href: string; label: string };

// Rol bazlı kalıcı üst navigasyon (#2). Route-group layout'larına gömülür.
const navByRole: Record<Role, { home: string; links: NavLink[] }> = {
  ADMIN: {
    home: "/admin-dashboard",
    links: [
      { href: "/admin-dashboard", label: "Panel" },
      { href: "/admin-dashboard/projects", label: "Projeler" },
      { href: "/admin-dashboard/messages", label: "Mesajlar" },
    ],
  },
  MENTOR: {
    home: "/mentor-dashboard",
    links: [
      { href: "/mentor-dashboard", label: "Panel" },
      { href: "/mentor-dashboard/messages", label: "Mesajlar" },
    ],
  },
  STUDENT: {
    home: "/student-dashboard",
    links: [
      { href: "/student-dashboard", label: "Panel" },
      { href: "/student-dashboard/messages", label: "Mesajlar" },
    ],
  },
};

// Tam ekran akışlarda (onboarding / profil kurulumu) kabuk gizlenir.
const HIDDEN_PREFIXES = ["/student-onboarding", "/profile-setup"];

export function AppShell({ role }: { role: Role }) {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const { home, links } = navByRole[role];

  // Ana panel linki tam eşleşme ister (alt sayfalarda vurgulanmasın);
  // diğerleri (Mesajlar/Projeler) prefix eşleşmesiyle vurgulanır.
  const isActive = (href: string) =>
    href === home ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        <Link href={home} className="flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </span>
          <span className="font-bold text-slate-900 hidden sm:inline">AISigner</span>
        </Link>

        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map((l) => {
            const active = isActive(l.href);
            const isMessages = l.href.endsWith("/messages");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {isMessages && <UnreadBadge className="text-current" />}
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto shrink-0">
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
