"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/signin" })} // Çıkış yapınca login ekranına yönlendir
      className="inline-flex items-center justify-center px-4 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl text-sm font-semibold transition-all shadow-sm"
    >
      <LogOut className="w-4 h-4 mr-2" />
      Çıkış Yap
    </button>
  );
}