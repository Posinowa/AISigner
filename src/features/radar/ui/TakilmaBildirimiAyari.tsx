"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";

/**
 * Takılma bildirimi tercihi (#397).
 *
 * ⚠️ METİN TONU ÖNEMLİ. "Gözetleniyorsun" değil "yardım isteyebilirsin".
 * Ayarın hedef kitlesi soru sormaktan çekinen stajyer; ürkütücü bir dil,
 * özelliği tam da ihtiyacı olan kişide kapalı bırakır.
 *
 * ⚠️ Profil tamamlama akışında GÖRÜNÜR yerde durmalı — gömülü bir tercih
 * ekranında kalırsa kimse fark etmez ve opt-in'in bilinen bedeli (erişimin
 * düşük kalması) daha da büyür.
 */
export function TakilmaBildirimiAyari({ baslangic }: { baslangic: boolean }) {
  const [acik, setAcik] = useState(baslangic);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  async function degistir(yeni: boolean) {
    setAcik(yeni);
    setKaydediliyor(true);
    try {
      const res = await fetch("/api/student/takilma-bildirimi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acik: yeni }),
      });
      if (!res.ok) {
        setAcik(!yeni);
        toast.error("Tercih kaydedilemedi.");
        return;
      }
      toast.success(yeni ? "Takıldığında sana haber vereceğiz." : "Bildirim kapatıldı.");
    } catch {
      setAcik(!yeni);
      toast.error("Bağlantı hatası.");
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={acik}
          disabled={kaydediliyor}
          onChange={(e) => degistir(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <LifeBuoy className="h-4 w-4 text-blue-600" />
            Bir adımda takılırsam bana haber ver
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-600">
            Bir adımda birkaç gün ilerleyemezsen sana kısa bir hatırlatma
            göndeririz — takıldığın yeri Posilog&apos;a sorabilirsin. İstediğin
            zaman kapatabilirsin.
          </span>
          <span className="mt-1 block text-[11px] text-slate-400">
            Mentörün, bu ayardan bağımsız olarak ilerlemeni zaten görebiliyor.
          </span>
        </span>
      </label>
    </div>
  );
}
