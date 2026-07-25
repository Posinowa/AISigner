"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200",
  MENTOR: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200",
  STUDENT: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200",
};

/**
 * Sadece development ortamında render edilir.
 * Sayfa içeriğini ezmemek için fixed pozisyonda, küçük ve toggle'lı.
 */
export function DebugNavbar() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-3 left-3 z-[9999] font-mono text-[11px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 text-white shadow-lg backdrop-blur-sm hover:bg-slate-800 transition-colors"
        title="Debug bilgisini göster/gizle"
      >
        <Bug className="w-3 h-3" />
        DEV
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl min-w-[220px]">
          {status === "loading" ? (
            <p className="text-slate-500 dark:text-slate-400">Oturum yükleniyor...</p>
          ) : session?.user?.email ? (
            <div className="space-y-1.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                  Email
                </p>
                <p className="text-slate-800 dark:text-slate-200">{session.user.email}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
                  Rol
                </p>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                    roleColors[session.user.role ?? ""] ??
                    "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {session.user.role ?? "?"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">Giriş yapılmamış</p>
          )}
        </div>
      )}
    </div>
  );
}
