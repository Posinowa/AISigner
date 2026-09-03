"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { UnreadBadge } from "@/features/messaging/ui/UnreadBadge";
import { BekleyenTalepRozeti } from "@/features/workspace-requests/ui/BekleyenTalepRozeti";
// #380: Kalıcı bildirimler — canlı akış yalnız açık sekmeye taşıyor.
import { BildirimZili } from "@/features/bildirim/ui/BildirimZili";
import Image from "next/image";

type Role = "ADMIN" | "MENTOR" | "STUDENT";
type NavLink = {
  href: string;
  label: string;
  /** #420: Mezun stajyerde gizlenir — erişemeyeceği sayfaya bağlantı verilmez. */
  mezunGizle?: boolean;
};

// Rol bazlı kalıcı üst navigasyon (#2). Route-group layout'larına gömülür.
const navByRole: Record<Role, { home: string; links: NavLink[] }> = {
  ADMIN: {
    home: "/admin-dashboard",
    links: [
      { href: "/admin-dashboard", label: "Panel" },
      { href: "/admin-dashboard/projects", label: "Projeler" },
      /*
       * #409: ETİKETLER KISALTILDI, ÖĞE GİZLENMEDİ.
       *
       * Ölçüm: menü TAŞMIYOR — kapsayıcıda `overflow-x-auto`, bağlantılarda
       * `whitespace-nowrap` var, yani düzen bozulmuyor, menü kendi içinde
       * kayıyor. Sorun keşfedilebilirlik: kaydırma çubuğu belirgin olmadığı
       * için sağdaki bağlantıların varlığı fark edilmeyebiliyor.
       *
       * ⚠️ AÇILIR MENÜ YAPILMADI. `UnreadBadge` ve `BekleyenTalepRozeti`
       * bağlantıların İÇİNDE; açılır menüye taşınan bir öğenin rozeti
       * görünmez olurdu ve o zaman kaybedilen şey bir özellik değil
       * BİLDİRİM olurdu — #349'un rozeti tam da darboğazı görünür kılmak
       * için konmuştu.
       *
       * Rozetler bağlamı zaten taşıdığı için kısa etiket yeterli.
       */
      // #349: Mentör taleplerinin kuyruğu. Rozet olmadan kuyruk fark edilmez.
      { href: "/admin-dashboard/workspace-requests", label: "Talepler" },
      // #366: Stajyerlerin kendi proje önerileri.
      { href: "/admin-dashboard/proposals", label: "Öneriler" },
      // #331: Darboğaz, yanıt süresi, gözden geçirilecek öğrenciler.
      { href: "/admin-dashboard/analytics", label: "Analitik" },
      // #332: Takım/Scrum projeleri.
      { href: "/admin-dashboard/teams", label: "Takımlar" },
      { href: "/admin-dashboard/messages", label: "Mesajlar" },
      /*
       * ⚠️ "İstekler" — "Öneriler"den AYRI bir şey: bu stajyerin admin'e
       * yazdığı öneri/istek (#147), diğeri stajyerin kendi PROJE önerisi
       * (#366). İki kısa ad birbirine karışmasın diye farklı sözcükler.
       */
      { href: "/admin-dashboard/suggestions", label: "İstekler" },
    ],
  },
  MENTOR: {
    home: "/mentor-dashboard",
    links: [
      { href: "/mentor-dashboard", label: "Panel" },
      // #331: Mentöre YALNIZCA kendi öğrencileri ve kendi yanıt süresi.
      { href: "/mentor-dashboard/analytics", label: "Analitik" },
      { href: "/mentor-dashboard/messages", label: "Mesajlar" },
    ],
  },
  STUDENT: {
    home: "/student-dashboard",
    links: [
      { href: "/student-dashboard", label: "Panel" },
      { href: "/student-dashboard/messages", label: "Mesajlar" },
      { href: "/student-dashboard/ai-analiz", label: "AI Analizim" },
      { href: "/student-dashboard/suggestions", label: "Öneri & İstek" },
      /*
       * #420: Panodaki iki blok kendi sayfalarına taşındı. Ölçülmüştü (#415):
       * öneri formu tek başına 745px'di ve üç adım kartının toplamından
       * büyüktü. Yılda bir kez kullanılan bir araç çalışma masasında durmamalı.
       *
       * ⚠️ "Projemi Öner" MEZUNA GÖSTERİLMİYOR (`mezunGizle`): #208'de
       * sistem durumunu değiştiren uçlar mezuna kapalı. Erişemeyeceği bir
       * sayfaya bağlantı göstermek yanıltıcı olurdu.
       *
       * ⚠️ "Mentör Görüşmesi" MEZUNA AÇIK — #398'deki bilinçli karar:
       * görüşme, mesajlaşma gibi *insan iletişimi* kanalı.
       */
      { href: "/student-dashboard/proposals", label: "Projemi Öner", mezunGizle: true },
      { href: "/student-dashboard/ofis-saati", label: "Mentör Görüşmesi" },
    ],
  },
};

// Tam ekran akışlarda (onboarding / profil kurulumu) kabuk gizlenir.
const HIDDEN_PREFIXES = ["/student-onboarding", "/profile-setup"];

export function AppShell({ role, mezun = false }: { role: Role; mezun?: boolean }) {
  const pathname = usePathname();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const { home, links: tumLinkler } = navByRole[role];
  const links = mezun ? tumLinkler.filter((l) => !l.mezunGizle) : tumLinkler;

  // Ana panel linki tam eşleşme ister (alt sayfalarda vurgulanmasın);
  // diğerleri (Mesajlar/Projeler) prefix eşleşmesiyle vurgulanır.
  const isActive = (href: string) =>
    href === home ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        <Link href={home} className="flex items-center gap-2 shrink-0">
          {/*
            #237: Jenerik GraduationCap ikonu yerine AISigner markasi. Acilis
            sayfasindan gelen kullanici panelde de ayni markayi goruyor.
          */}
          <Image
            src="/brand/aisigner-mark.png"
            alt=""
            width={37}
            height={32}
            priority
            className="h-8 w-auto"
          />
          <span className="font-bold text-slate-900 hidden sm:inline">AISigner</span>
        </Link>

        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map((l) => {
            const active = isActive(l.href);
            const isMessages = l.href.endsWith("/messages");
            const isTalepler = l.href.endsWith("/workspace-requests");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {isMessages && <UnreadBadge className="text-current" />}
                {l.label}
                {isTalepler && <BekleyenTalepRozeti />}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto shrink-0 flex items-center gap-1">
          <BildirimZili />
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
