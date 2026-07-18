import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DebugNavbar } from "@/components/DebugNavbar"
import { SessionProvider } from "@/components/SessionProvider"
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog"
import { Toaster } from "sonner"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AISigner - AI Destekli Stajyer Mentorluk Platformu",
  description: "Stajyer ve öğrencilerin AI destekli profil analizi, mentor eşleştirmesi ve kişiselleştirilmiş öğrenme yol haritası ile gelişimini destekleyen açık kaynak platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 🔐 NextAuth oturum sağlayıcısı */}
        <SessionProvider>
          {/* #92: Uygulama geneli onay dialogu (native confirm yerine) */}
          <ConfirmDialogProvider>

       {/* 🧭 Debug bar - sadece development ortamında görünür */}
        {process.env.NODE_ENV === "development" && <DebugNavbar />}

        {children}
        <Toaster richColors position="top-right" />
          </ConfirmDialogProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
