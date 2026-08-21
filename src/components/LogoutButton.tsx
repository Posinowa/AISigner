"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/signin" })} // Çıkış yapınca login ekranına yönlendir
      className="inline-flex items-center justify-center px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-semibold transition-all shadow-sm"
    >
      <LogOut className="w-4 h-4 mr-2" />
      Çıkış Yap
    </button>
  );
}