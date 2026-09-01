"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";
import { ROL_ROZETI } from "@/lib/ui/rol-renkleri";

const roleColors: Record<string, string> = {
  ADMIN: ROL_ROZETI.ADMIN.sinif,
  MENTOR: ROL_ROZETI.MENTOR.sinif,
  STUDENT: ROL_ROZETI.STUDENT.sinif,
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
        <div className="mt-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-xl min-w-[220px]">
          {status === "loading" ? (
            <p className="text-slate-500">Oturum yükleniyor...</p>
          ) : session?.user?.email ? (
            <div className="space-y-1.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Email
                </p>
                <p className="text-slate-800">{session.user.email}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Rol
                </p>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                    roleColors[session.user.role ?? ""] ??
                    "bg-slate-50 text-slate-700 border-slate-200"
                  }`}
                >
                  {session.user.role ?? "?"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Giriş yapılmamış</p>
          )}
        </div>
      )}
    </div>
  );
}
