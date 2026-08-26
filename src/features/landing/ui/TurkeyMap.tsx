"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PROVINCES,
  SEED_PROVINCES,
  FLIPPED_LABELS,
  MAP_VIEWBOX,
} from "../data/tr-provinces";

/*
  Animasyon akışı:
    1) iller Ankara'dan dışa doğru belirir
    2) 10 seed il tek tek yanar (pin + halka)
    3) kalan iller dalga halinde maviye döner
    4) sayaç gerçekten boyanan il sayısını gösterir — 81'de biter

  Zamanlayıcılar setTimeout ile kuruluyor; hepsi tek bir ref'te toplanıp
  temizleniyor, aksi halde "tekrar oynat"a üst üste basınca eski
  zamanlayıcılar yeni turu bozardı.
*/

const T_IN = 200; // iller belirmeye başlar
const IN_STEP = 11; // il başına gecikme
const T_SEED0 = 1500; // Ankara yanar
const SEED_GAP = 360;
const WAVE_STEP = 34; // dalgadaki iller arası gecikme

type Durum = {
  belirdi: Set<string>;
  yandi: Set<string>;
  pin: Set<string>;
};

const BOS: Durum = { belirdi: new Set(), yandi: new Set(), pin: new Set() };

export function TurkeyMap() {
  const [durum, setDurum] = useState<Durum>(BOS);
  const [uzerinde, setUzerinde] = useState<string | null>(null);
  const zamanlayicilar = useRef<ReturnType<typeof setTimeout>[]>([]);
  const kutu = useRef<HTMLDivElement>(null);
  const calisiyor = useRef(false);

  const ankara = useMemo(
    () => PROVINCES.find((p) => p.name === "Ankara"),
    [],
  );

  /** Ankara'ya uzaklığa göre sıralı il adları */
  const uzakliktanSirali = useMemo(() => {
    if (!ankara) return PROVINCES.map((p) => p.name);
    return [...PROVINCES]
      .sort((a, b) => {
        const da = Math.hypot(a.cx - ankara.cx, a.cy - ankara.cy);
        const db = Math.hypot(b.cx - ankara.cx, b.cy - ankara.cy);
        return da - db;
      })
      .map((p) => p.name);
  }, [ankara]);

  /** Seed olmayan iller — dalga bunları sırayla boyar */
  const dalgaSirasi = useMemo(
    () =>
      uzakliktanSirali.filter(
        (ad) => !(SEED_PROVINCES as readonly string[]).includes(ad),
      ),
    [uzakliktanSirali],
  );

  const temizle = useCallback(() => {
    zamanlayicilar.current.forEach(clearTimeout);
    zamanlayicilar.current = [];
  }, []);

  const sonDurum = useCallback(() => {
    setDurum({
      belirdi: new Set(PROVINCES.map((p) => p.name)),
      yandi: new Set(PROVINCES.map((p) => p.name)),
      pin: new Set(SEED_PROVINCES),
    });
  }, []);

  const oynat = useCallback(() => {
    temizle();
    setDurum(BOS);

    const azHareket =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (azHareket) {
      // hareket istemeyen kullanıcı bitmiş haritayı hemen görür
      sonDurum();
      return;
    }

    calisiyor.current = true;
    const ekle = (ms: number, fn: () => void) => {
      zamanlayicilar.current.push(setTimeout(fn, ms));
    };

    // 1) beliriş
    uzakliktanSirali.forEach((ad, i) => {
      ekle(T_IN + i * IN_STEP, () =>
        setDurum((d) => ({ ...d, belirdi: new Set(d.belirdi).add(ad) })),
      );
    });

    // 2) seed iller
    SEED_PROVINCES.forEach((ad, i) => {
      ekle(T_SEED0 + i * SEED_GAP, () =>
        setDurum((d) => ({
          ...d,
          yandi: new Set(d.yandi).add(ad),
          pin: new Set(d.pin).add(ad),
        })),
      );
    });

    // 3) dalga
    const dalgaBasi = T_SEED0 + SEED_GAP * SEED_PROVINCES.length + 320;
    dalgaSirasi.forEach((ad, i) => {
      ekle(dalgaBasi + i * WAVE_STEP, () =>
        setDurum((d) => ({ ...d, yandi: new Set(d.yandi).add(ad) })),
      );
    });

    ekle(dalgaBasi + dalgaSirasi.length * WAVE_STEP + 400, () => {
      calisiyor.current = false;
    });
  }, [temizle, sonDurum, uzakliktanSirali, dalgaSirasi]);

  // haritayı ekrana girince başlat
  useEffect(() => {
    const el = kutu.current;
    if (!el) return;

    const azHareket = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (azHareket) {
      // gözlemciyi beklemeden bitmiş hali göster
      sonDurum();
      return;
    }

    const io = new IntersectionObserver(
      (girisler) => {
        for (const g of girisler) {
          if (g.isIntersecting && !calisiyor.current) {
            oynat();
            io.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [oynat, sonDurum]);

  // ayrılırken zamanlayıcıları bırakma
  useEffect(() => temizle, [temizle]);

  // dar ekranda harita yatay kayar — ülkenin ortasından başlat
  useEffect(() => {
    const el = kutu.current;
    if (!el) return;
    const ortala = () => {
      const tasan = el.scrollWidth - el.clientWidth;
      if (tasan > 0) el.scrollLeft = tasan / 2;
    };
    ortala();
    window.addEventListener("resize", ortala);
    return () => window.removeEventListener("resize", ortala);
  }, []);

  const sayac = durum.yandi.size;

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[var(--landing-line-soft)] bg-[var(--landing-stage)] p-[clamp(10px,1.5vw,16px)]">
      <div
        ref={kutu}
        className="w-full overflow-x-auto [scrollbar-width:thin]"
        data-testid="harita-kutusu"
      >
        <div className="relative mx-auto w-full max-[680px]:min-w-[620px] min-[681px]:max-w-[max(560px,calc((100vh-486px)*2.976))]">
          <svg
            viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto w-full overflow-visible"
            role="img"
            aria-label="Türkiye haritası: iller tek tek maviye boyanarak 81 ilin tamamı kaplanıyor."
          >
            <g>
              {PROVINCES.map((il) => (
                <path
                  key={il.name}
                  d={il.d}
                  className="landing-prov"
                  data-in={durum.belirdi.has(il.name)}
                  data-lit={durum.yandi.has(il.name)}
                  data-seed={durum.pin.has(il.name)}
                  data-hover={uzerinde === il.name}
                  data-il={il.name}
                  onPointerEnter={() => setUzerinde(il.name)}
                  onPointerLeave={() => setUzerinde(null)}
                >
                  <title>{il.name}</title>
                </path>
              ))}
            </g>
          </svg>

          {SEED_PROVINCES.map((ad) => {
            const il = PROVINCES.find((p) => p.name === ad);
            if (!il) return null;
            const sola = FLIPPED_LABELS.has(ad);
            return (
              <div
                key={ad}
                className="landing-pin"
                data-on={durum.pin.has(ad)}
                style={{
                  left: `${(il.cx / MAP_VIEWBOX.width) * 100}%`,
                  top: `${(il.cy / MAP_VIEWBOX.height) * 100}%`,
                }}
              >
                <span className="landing-pin-core" />
                <span
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[4px] bg-[color-mix(in_srgb,var(--landing-stage)_80%,transparent)] px-1 py-px font-mono text-[clamp(8.5px,0.95vw,10.5px)] uppercase tracking-[0.05em] text-[var(--landing-ink)] max-[680px]:hidden ${
                    sola ? "right-[10px]" : "left-[10px]"
                  }`}
                >
                  {ad}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="absolute bottom-[clamp(12px,2.2vw,22px)] left-[clamp(12px,2.2vw,22px)] flex items-baseline gap-2 rounded-lg bg-[color-mix(in_srgb,var(--landing-stage)_84%,transparent)] px-3 pb-2.5 pt-2 font-mono tabular-nums backdrop-blur-[3px]"
        aria-hidden="true"
      >
        <span className="text-[clamp(28px,4.6vw,44px)] font-bold leading-none tracking-[-0.04em] text-[var(--landing-navy)]">
          {String(sayac).padStart(2, "0")}
        </span>
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--landing-muted)]">
          / 81 il
        </span>
      </div>

      <button
        type="button"
        onClick={oynat}
        className="absolute bottom-[clamp(12px,2.2vw,22px)] right-[clamp(12px,2.2vw,22px)] cursor-pointer rounded-md border border-[var(--landing-line)] bg-[color-mix(in_srgb,var(--landing-paper)_82%,transparent)] px-[11px] py-[7px] font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--landing-muted)] transition-colors hover:border-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
      >
        Tekrar oynat
      </button>

      <p className="sr-only" aria-live="polite">
        {sayac} il boyandı
      </p>
    </div>
  );
}
