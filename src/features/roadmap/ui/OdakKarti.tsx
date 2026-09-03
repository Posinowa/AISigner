"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, CheckCircle2, Github, Loader2, PlayCircle } from "lucide-react";
import { adimDurumunuGuncelle } from "./adim-durumu-guncelle";

/**
 * Bugün üzerinde çalışılacak adım — eylemleriyle birlikte (#416).
 *
 * ⚠️ YENİ BİR İŞARET DEĞİL, VAR OLANIN EYLEME DÖNÜŞMESİ. Panoda zaten
 * "SIRADA → <adım>" bağlantısı vardı (#290). Eksik olan bilgi değil eylemdi:
 * GitHub'a gitmek, adımı tamamlamak ya da mentörün revizyon gerekçesini
 * okumak için öğrencinin 2.6 ekran aşağı kaydırıp doğru kartı bulması
 * gerekiyordu (#415'teki ölçüm).
 *
 * Bu yüzden karşılamadaki "SIRADA" bağlantısı bu kart varken BASTIRILIYOR —
 * aynı bilgi iki yerde dursaydı biri güncellenip diğeri unutulurdu.
 */

export type OdakVerisi = {
  stepId: string;
  baslik: string;
  aciklama: string;
  durum: string;
  sira: number;
  projeAdi: string;
  githubIssueUrl: string | null;
  revizyonGerekcesi: string | null;
  /** Adım listesindeki karta götüren çapa. */
  capa: string;
  /** #332: Takım panosunda adım başkasının üstünde olabilir. */
  ustlenenAdi: string | null;
};

export function OdakKarti({
  odak,
  saltOkunur,
}: {
  odak: OdakVerisi;
  /** Taslak yol haritası (#52/#405) veya mezun stajyer (#208) — eylem yok. */
  saltOkunur: boolean;
}) {
  const router = useRouter();
  const [calisiyor, setCalisiyor] = useState(false);
  const [, startTransition] = useTransition();

  const revizyon = odak.durum === "REVISION_REQUESTED";
  const devamEdiyor = odak.durum === "IN_PROGRESS";

  async function durumDegistir(yeniDurum: "IN_PROGRESS" | "COMPLETED") {
    setCalisiyor(true);
    const oldu = await adimDurumunuGuncelle({
      stepId: odak.stepId,
      yeniDurum,
      // Salt okunur kart eylem göstermiyor; yine de sunucuya güvenilmiyor.
      mezunMu: saltOkunur,
    });
    if (oldu) startTransition(() => router.refresh());
    setCalisiyor(false);
  }

  return (
    <section
      className={`mb-6 rounded-2xl border p-5 shadow-sm ${
        revizyon ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {revizyon ? "Mentörün düzeltme istedi" : devamEdiyor ? "Üzerinde çalışıyorsun" : "Sıradaki adımın"}
        </p>
        <p className="text-xs text-slate-500">
          {odak.projeAdi} · Aşama {odak.sira}
        </p>
      </div>

      <h2 className="mt-1 text-lg font-bold text-slate-900">{odak.baslik}</h2>

      {odak.aciklama && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">
          {odak.aciklama}
        </p>
      )}

      {/* #332: Adım takımın; başkası üstlendiyse "senin adımın" demek yanlış. */}
      {odak.ustlenenAdi && (
        <p className="mt-2 text-xs font-medium text-indigo-700">
          Bu adımı {odak.ustlenenAdi} üstlendi.
        </p>
      )}

      {/* #379: Gerekçe adımda değil GEÇİŞTE duruyor; öğrenciye gösterilmesi
          zorunlu, yoksa aynı işi tekrar yapar. */}
      {revizyon && odak.revizyonGerekcesi && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/70 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-amber-900">{odak.revizyonGerekcesi}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!saltOkunur && !devamEdiyor && (
          <button
            onClick={() => durumDegistir("IN_PROGRESS")}
            disabled={calisiyor}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {calisiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {revizyon ? "Düzeltmeye başla" : "Adıma başla"}
          </button>
        )}

        {/* ⚠️ Revizyondaki adım DOĞRUDAN tamamlanamaz — #379'daki kuralın
            aynısı: önce yeniden başlatılır. Sunucu da bunu reddediyor. */}
        {!saltOkunur && devamEdiyor && (
          <button
            onClick={() => durumDegistir("COMPLETED")}
            disabled={calisiyor}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {calisiyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Adımı tamamla
          </button>
        )}

        {odak.githubIssueUrl && (
          <a
            href={odak.githubIssueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Github className="h-4 w-4" />
            GitHub issue
          </a>
        )}

        {/* Dosya, yorum ve kaynaklar adım kartında; burada kopyalanmıyor —
            iki yerde duran bir yükleyici iki ayrı doğruluk kaynağı olurdu. */}
        <a
          href={odak.capa}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowDown className="h-4 w-4" />
          Kaynaklar, dosyalar ve yorumlar
        </a>
      </div>
    </section>
  );
}
