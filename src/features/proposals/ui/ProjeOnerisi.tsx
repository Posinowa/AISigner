"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Lightbulb, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Info } from "lucide-react";

/**
 * Stajyerin kendi proje önerisi (#366).
 *
 * ⚠️ ARAYÜZ KAYNAKLARIN BEDELİNİ SÖYLÜYOR. "Var olan depomu bağlayın"
 * seçildiğinde webhook ve AI kod incelemesi ÇALIŞMAZ (depo stajyerin
 * hesabında, `GITHUB_TOKEN` orada yetkisiz — #348 çözer). Bunu yazmasaydık
 * stajyer özelliklerin sessizce kaybolduğunu sanırdı.
 *
 * "Devredeceğim" seçildiğinde de transferi PLATFORM YAPMAZ: adımlar stajyere
 * gösteriliyor, admin devri tespit edip onaylıyor.
 */

const KAYNAKLAR = [
  {
    deger: "BIZIM",
    etiket: "Repoyu siz açın",
    aciklama:
      "Onaylanınca sizin için yeni bir depo açılır; yol haritası, issue'lar, webhook ve AI kod incelemesi eksiksiz çalışır.",
    uyari: null,
  },
  {
    deger: "BAGLA",
    etiket: "Var olan depomu bağlayın",
    aciklama: "Deponuz sizde kalır, sadece bu atamaya bağlanır.",
    uyari:
      "Depo sizin hesabınızda kaldığı için otomatik PR incelemesi ve adım tamamlama (webhook) ÇALIŞMAZ. Bunlar ancak platform GitHub App'e geçince mümkün olur.",
  },
  {
    deger: "DEVRET",
    etiket: "Depomu organizasyona devredeceğim",
    aciklama: "Depo Posinowa organizasyonuna geçer; tüm otomasyon çalışır.",
    uyari:
      "Devri PLATFORM YAPAMAZ — GitHub yalnızca depo sahibinin başlatmasına izin verir. Onay öncesi kendiniz devretmeniz gerekir (Settings → Danger Zone → Transfer ownership). Devir sonrası deponun MÜLKİYETİ organizasyona geçer.",
  },
] as const;

type Oneri = {
  id: string;
  title: string;
  kaynak: string;
  kararKaynak: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  repoUrl: string | null;
};

export function ProjeOnerisi() {
  const [oneriler, setOneriler] = useState<Oneri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [teknolojiler, setTeknolojiler] = useState("");
  const [kaynak, setKaynak] = useState<string>("BIZIM");
  const [repoUrl, setRepoUrl] = useState("");

  const getir = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const res = await fetch("/api/student/proposals");
      if (!res.ok) {
        setHata(true);
        return;
      }
      setOneriler((await res.json()).oneriler ?? []);
    } catch {
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    getir();
  }, [getir]);

  const bekleyen = oneriler.find((o) => o.status === "PENDING");
  const secili = KAYNAKLAR.find((k) => k.deger === kaynak)!;

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setGonderiliyor(true);
    try {
      const res = await fetch("/api/student/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          goals,
          technologies: teknolojiler
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          kaynak,
          repoUrl: kaynak === "BIZIM" ? null : repoUrl,
        }),
      });
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof veri.error === "string" ? veri.error : "Öneri gönderilemedi.");
        return;
      }
      toast.success("Öneriniz gönderildi. Yönetici değerlendirdiğinde bilgilendirileceksiniz.");
      setTitle("");
      setDescription("");
      setGoals("");
      setTeknolojiler("");
      setRepoUrl("");
      await getir();
    } catch {
      toast.error("Öneri gönderilemedi. Bağlantınızı kontrol edin.");
    } finally {
      setGonderiliyor(false);
    }
  }

  if (yukleniyor) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Yükleniyor…
      </div>
    );
  }

  if (hata) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
        <AlertTriangle className="mx-auto h-5 w-5 text-red-600" />
        <p className="mt-2 text-sm font-medium text-red-800">Önerileriniz yüklenemedi.</p>
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
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        Kendi projeni öner
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Hazır projelerden seçmek yerine kendi fikrini önerebilirsin. Yönetici
        onayladığında normal bir staj projesine dönüşür.
      </p>

      {oneriler.length > 0 && (
        <ul className="mt-4 space-y-2">
          {oneriler.map((o) => (
            <li key={o.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{o.title}</span>
                <DurumRozeti status={o.status} />
              </div>
              {/* Red gerekçesi sunucuda ZORUNLU; stajyer nedenini görmezse aynı
                  öneriyi tekrar açar. */}
              {o.adminNote && (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{o.adminNote}</p>
              )}
              {o.status === "APPROVED" && o.kararKaynak && o.kararKaynak !== o.kaynak && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Yönetici GitHub kaynağını değiştirdi:{" "}
                  {KAYNAKLAR.find((k) => k.deger === o.kararKaynak)?.etiket}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {bekleyen ? (
        <p className="mt-4 flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Değerlendirilmeyi bekleyen bir öneriniz var. Sonuçlandığında yeni öneri
          gönderebilirsiniz.
        </p>
      ) : (
        <form onSubmit={gonder} className="mt-4 space-y-3">
          <Alan etiket="Proje başlığı" htmlFor="oneri-baslik">
            <input
              id="oneri-baslik"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Örn: Kişisel Finans Takip Uygulaması"
            />
          </Alan>

          <Alan etiket="Ne yapacaksın?" htmlFor="oneri-aciklama">
            <textarea
              id="oneri-aciklama"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={4000}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Projenin ne yaptığını ve temel özelliklerini anlat."
            />
          </Alan>

          <Alan etiket="Bu projeden ne öğrenmeyi hedefliyorsun?" htmlFor="oneri-hedef">
            <textarea
              id="oneri-hedef"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              maxLength={2000}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Alan>

          <Alan etiket="Teknolojiler (virgülle ayır)" htmlFor="oneri-tek">
            <input
              id="oneri-tek"
              value={teknolojiler}
              onChange={(e) => setTeknolojiler(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Next.js, PostgreSQL, Prisma"
            />
          </Alan>

          <fieldset className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-700">GitHub tercihi</legend>
            <div className="space-y-2">
              {KAYNAKLAR.map((k) => (
                <label key={k.deger} className="flex gap-2 text-sm">
                  <input
                    type="radio"
                    name="kaynak"
                    value={k.deger}
                    checked={kaynak === k.deger}
                    onChange={(e) => setKaynak(e.target.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-slate-800">{k.etiket}</span>
                    <span className="block text-xs text-slate-500">{k.aciklama}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* Bedeli seçim anında göster: sonradan öğrenmek kötü sürpriz olur. */}
            {secili.uyari && (
              <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {secili.uyari}
              </p>
            )}

            {kaynak !== "BIZIM" && (
              <div className="mt-2">
                <label htmlFor="oneri-repo" className="text-xs font-medium text-slate-700">
                  Depo adresi
                </label>
                <input
                  id="oneri-repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="https://github.com/kullanici/depo"
                />
              </div>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={gonderiliyor}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {gonderiliyor ? "Gönderiliyor…" : "Öneriyi gönder"}
          </button>
        </form>
      )}
    </section>
  );
}

function Alan({
  etiket,
  htmlFor,
  children,
}: {
  etiket: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-xs font-medium text-slate-700">
        {etiket}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function DurumRozeti({ status }: { status: string }) {
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Onaylandı
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
        <XCircle className="h-3 w-3" /> Reddedildi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      <Clock className="h-3 w-3" /> Değerlendiriliyor
    </span>
  );
}
