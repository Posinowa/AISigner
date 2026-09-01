"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, AlertTriangle, TrendingUp, Clock, Users, Info } from "lucide-react";

/**
 * Analitik panel (#331).
 *
 * ⚠️ RİSK LİSTESİNDE SKOR YOK, SİNYAL VAR. "Bırakma riski %73" gibi bir sayı
 * ölçülmüş hiçbir şeye dayanmaz ve okuyanı sorgulamadan güvenmeye iter
 * (#328'deki yüzde tartışmasının aynısı). Bunun yerine doğrulanabilir olgular
 * gösteriliyor: kaç gündür sessiz, kaç adım takılı, bekleyen soru var mı.
 * Yargıyı mentör kuruyor.
 *
 * Bu panel ÖĞRENCİYE GÖSTERİLMEZ — mentör ve admin alanlarında mount edilir.
 */

type Darbogaz = {
  projeBasligi: string;
  adimSirasi: number;
  adimBasligi: string;
  tamamlayanSayisi: number;
  ortalamaGun: number;
  ortancaGun: number;
};

type YanitSuresi = {
  mentorId: string;
  ad: string | null;
  soyad: string | null;
  email: string;
  yanitlananSoru: number;
  ortalamaSaat: number;
  ortancaSaat: number;
};

type Riskli = {
  studentUserId: string;
  ad: string | null;
  soyad: string | null;
  email: string;
  sessizGun: number | null;
  takilanAdim: number;
  bekleyenSoru: boolean;
};

type Veri = {
  darbogazlar: Darbogaz[];
  yanitSureleri: YanitSuresi[];
  riskliler: Riskli[];
  uretildi: string;
};

const isim = (a: { ad: string | null; soyad: string | null; email: string }) =>
  [a.ad, a.soyad].filter(Boolean).join(" ") || a.email;

export function AnalitikPanel({ kaynak }: { kaynak: string }) {
  const [veri, setVeri] = useState<Veri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  // #159 deseni: boş sonuç ile hata AYRI. Sessizce boş panel göstermek,
  // "veri yok" ile "yüklenemedi"yi karıştırır.
  const [hata, setHata] = useState(false);

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const res = await fetch(kaynak);
      if (!res.ok) {
        setHata(true);
        return;
      }
      setVeri(await res.json());
    } catch {
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, [kaynak]);

  useEffect(() => {
    getir();
  }, [getir]);

  if (yukleniyor) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Analitik hesaplanıyor…
      </div>
    );
  }

  if (hata || !veri) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-red-600" />
        <p className="mt-2 text-sm font-medium text-red-800">Analitik veriler yüklenemedi.</p>
        <button
          onClick={getir}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Kart
        baslik="Nerede takılıyorlar?"
        aciklama="Adımın başlatılmasından tamamlanmasına kadar geçen süre; proje ve adım sırasına göre gruplanır. Sıralama ortancaya göre — tek bir öğrencinin yarım bıraktığı adım ortalamayı uçurur, ortanca dayanıklıdır. Yol haritaları öğrenciye özel üretildiği için gösterilen adım başlığı gruptan bir ÖRNEKTİR."
        ikon={<TrendingUp className="h-4 w-4" />}
      >
        {veri.darbogazlar.length === 0 ? (
          <Bos>Henüz tamamlanmış adım yok.</Bos>
        ) : (
          <Tablo basliklar={["Proje", "Adım", "Ortanca", "Ortalama", "Tamamlayan"]}>
            {veri.darbogazlar.map((d) => (
              <tr key={`${d.projeBasligi}-${d.adimSirasi}`} className="border-t border-slate-100">
                <Hucre>{d.projeBasligi}</Hucre>
                <Hucre>
                  <span className="font-medium text-slate-800">{d.adimSirasi}.</span>{" "}
                  {/* Başlık gruptaki bir örnek; birden çok öğrenci varsa
                      başlıkları farklı olabilir (açıklamada belirtiliyor). */}
                  <span className="text-slate-600" title="Gruptan örnek başlık">
                    {d.adimBasligi}
                  </span>
                </Hucre>
                <Hucre>
                  <span className="font-semibold text-slate-900">{d.ortancaGun} gün</span>
                </Hucre>
                <Hucre>{d.ortalamaGun} gün</Hucre>
                <Hucre>{d.tamamlayanSayisi}</Hucre>
              </tr>
            ))}
          </Tablo>
        )}
      </Kart>

      <Kart
        baslik="Yanıt süresi"
        aciklama="Öğrencinin mesajından sonraki ilk mentör yanıtına kadar geçen süre. Arka arkaya gelen öğrenci mesajları tek bekleyiş sayılır."
        ikon={<Clock className="h-4 w-4" />}
      >
        {veri.yanitSureleri.length === 0 ? (
          <Bos>Henüz yanıtlanmış mesaj yok.</Bos>
        ) : (
          <Tablo basliklar={["Mentör", "Ortanca", "Ortalama", "Yanıt"]}>
            {veri.yanitSureleri.map((y) => (
              <tr key={y.mentorId} className="border-t border-slate-100">
                <Hucre>{isim(y)}</Hucre>
                <Hucre>
                  <span className="font-semibold text-slate-900">{y.ortancaSaat} saat</span>
                </Hucre>
                <Hucre>{y.ortalamaSaat} saat</Hucre>
                <Hucre>{y.yanitlananSoru}</Hucre>
              </tr>
            ))}
          </Tablo>
        )}
      </Kart>

      <Kart
        baslik="Gözden geçirilmesi gerekenler"
        aciklama="Risk skoru üretilmiyor. Aşağıdakiler doğrulanabilir sinyaller; kararı siz verirsiniz."
        ikon={<Users className="h-4 w-4" />}
      >
        {veri.riskliler.length === 0 ? (
          <Bos>Dikkat gerektiren öğrenci yok.</Bos>
        ) : (
          <ul className="space-y-2">
            {veri.riskliler.map((r) => (
              <li
                key={r.studentUserId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
              >
                <span className="text-sm font-medium text-slate-800">{isim(r)}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Rozet ton={r.sessizGun === null || r.sessizGun >= 21 ? "kirmizi" : "amber"}>
                    {r.sessizGun === null
                      ? "Hiç hareket yok"
                      : `${r.sessizGun} gündür sessiz`}
                  </Rozet>
                  {r.takilanAdim > 0 && (
                    <Rozet ton="amber">{r.takilanAdim} adım takılı</Rozet>
                  )}
                  {r.bekleyenSoru && <Rozet ton="mavi">Yanıtlanmamış mesajı var</Rozet>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Kart>

      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Info className="h-3 w-3" />
        Veriler en fazla 5 dakikada bir tazelenir · son hesaplama{" "}
        {new Date(veri.uretildi).toLocaleTimeString("tr-TR")}
      </p>
    </div>
  );
}

function Kart({
  baslik,
  aciklama,
  ikon,
  children,
}: {
  baslik: string;
  aciklama: string;
  ikon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <span className="text-blue-600">{ikon}</span>
        {baslik}
      </h2>
      {/* Ölçütün NASIL hesaplandığı görünür olmalı: açıklaması olmayan bir
          sayı, okuyanın kendi varsayımıyla doldurduğu bir boşluktur. */}
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{aciklama}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tablo({
  basliklar,
  children,
}: {
  basliklar: string[];
  children: React.ReactNode;
}) {
  return (
    // Dar ekranda tablo sayfayı yatay kaydırmasın, kendi içinde kaysın.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {basliklar.map((b) => (
              <th key={b} className="pb-2 pr-4 font-semibold">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Hucre({ children }: { children: React.ReactNode }) {
  return <td className="py-2 pr-4 text-slate-700">{children}</td>;
}

function Bos({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-sm text-slate-500">{children}</p>;
}

const TONLAR = {
  kirmizi: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  mavi: "bg-blue-50 text-blue-700 border-blue-200",
} as const;

function Rozet({ ton, children }: { ton: keyof typeof TONLAR; children: React.ReactNode }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${TONLAR[ton]}`}>
      {children}
    </span>
  );
}
