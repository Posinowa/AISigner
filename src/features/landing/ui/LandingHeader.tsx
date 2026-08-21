"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const MENU = [
  { href: "#nasil", label: "Nasıl işliyor" },
  { href: "#platform", label: "Platform" },
  { href: "#kapsam", label: "Kapsam" },
  { href: "#posinowa", label: "Posinowa" },
];

export function LandingHeader() {
  const [kaydi, setKaydi] = useState(false);

  // sayfa kaydıkça bar içerikten ayrılsın (yalnız gölge — yükseklik sabit)
  useEffect(() => {
    let bekliyor = false;
    const esitle = () => {
      setKaydi(window.scrollY > 8);
      bekliyor = false;
    };
    const dinle = () => {
      if (!bekliyor) {
        bekliyor = true;
        requestAnimationFrame(esitle);
      }
    };
    esitle();
    window.addEventListener("scroll", dinle, { passive: true });
    return () => window.removeEventListener("scroll", dinle);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b border-[var(--landing-line-soft)] bg-[color-mix(in_srgb,var(--landing-paper)_86%,transparent)] backdrop-blur-md transition-[box-shadow,border-color] duration-200 ${
        kaydi
          ? "border-[var(--landing-line)] shadow-[0_1px_14px_-6px_rgba(8,24,42,0.28)]"
          : ""
      }`}
    >
      <div className="mx-auto flex h-[66px] w-[min(100%-2*clamp(20px,5vw,56px),1180px)] items-center gap-4 md:gap-7">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15.5px] font-extrabold tracking-[-0.03em] sm:gap-[11px] sm:text-[17px]"
        >
          <Image
            src="/brand/aisigner-mark.png"
            alt="AISigner"
            width={30}
            height={26}
            priority
            className="h-[26px] w-auto"
          />
          <span className="hidden h-5 w-px bg-[var(--landing-line)] sm:block" />
          AISigner
        </Link>

        <nav aria-label="Ana menü" className="ml-auto hidden gap-[22px] lg:flex">
          {MENU.map((m) => (
            <a
              key={m.href}
              href={m.href}
              className="text-sm text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
            >
              {m.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
          <Link
            href="/signin"
            className="inline-flex h-[34px] items-center justify-center rounded-md border border-[var(--landing-line)] px-2.5 text-[12.5px] font-semibold text-[var(--landing-ink)] transition-colors hover:border-[var(--landing-muted)] sm:px-[13px] sm:text-[13px]"
          >
            Giriş yap
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-[34px] items-center justify-center rounded-md bg-[var(--landing-navy)] px-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--landing-navy)_86%,#000)] sm:px-[13px] sm:text-[13px]"
          >
            Kayıt ol
          </Link>
        </div>
      </div>
    </header>
  );
}
