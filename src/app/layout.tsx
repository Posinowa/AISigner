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

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aisigner.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "AISigner - AI Destekli Stajyer ve Mentörlük Platformu",
    template: "%s | AISigner",
  },
  description:
    "Stajyer ve öğrencilerin AI destekli profil analizi, mentör eşleştirmesi ve kişiselleştirilmiş öğrenme yol haritası ile gelişimini destekleyen açık kaynak platform.",
  keywords: [
    "AISigner",
    "staj",
    "stajyer",
    "mentörlük",
    "yapay zeka",
    "yol haritası",
    "yazılım stajı",
    "kariyer gelişimi",
  ],
  authors: [{ name: "Posinowa Akademi", url: baseUrl }],
  creator: "Posinowa",
  publisher: "Posinowa",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: baseUrl,
    title: "AISigner - AI Destekli Stajyer ve Mentörlük Platformu",
    description:
      "Stajyer ve öğrencilerin AI destekli profil analizi, mentör eşleştirmesi ve kişiselleştirilmiş öğrenme yol haritası platformu.",
    siteName: "AISigner",
  },
  twitter: {
    card: "summary_large_image",
    title: "AISigner - AI Destekli Stajyer ve Mentörlük Platformu",
    description:
      "Stajyer ve öğrencilerin AI destekli profil analizi, mentör eşleştirmesi ve kişiselleştirilmiş öğrenme yol haritası platformu.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/*
          #dark: Flash önleme. Sayfa boyanmadan ÖNCE tema sınıfını uygular;
          aksi halde koyu tema seçili kullanıcı bir an beyaz ekran görür.
          localStorage boşsa sistem tercihine düşer.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
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
