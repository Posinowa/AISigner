"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Canlı akışa bağlanan istemci kancası (#329).
 *
 * ⚠️ YOKLAMA YEDEĞİ KALDIRILMADI, KOŞULLU HALE GETİRİLDİ.
 * SSE bir vekil, kurumsal güvenlik duvarı ya da tarayıcı eklentisi tarafından
 * kesilebilir. Akış çalışmıyorken mesajlaşmanın TAMAMEN durması, 5 saniyelik
 * gecikmeden çok daha kötü bir sonuç olurdu. Bu yüzden kanca "bağlı mıyım"
 * bilgisini döndürüyor ve çağıran taraf yoklamayı yalnızca bağlı DEĞİLKEN
 * çalıştırıyor.
 *
 * ⚠️ BAĞLANTI SEKME BAŞINA TEKTİR, BİLEŞEN BAŞINA DEĞİL (#358).
 * Önceden her çağrı kendi `EventSource`'unu kuruyordu ve mount yerleri
 * örtüştüğü için tek sayfada 2–3 kalıcı bağlantı açılıyordu (öğrenci mesajlar
 * sayfası: `UnreadBadge` + `AdimKutlamasi` + `MessagingPanel`). Sonucu:
 * sunucuda kullanıcı başına 2–3 abonelik ve 2–3 kalp atışı — yani #329'un
 * "maliyet kullanıcı sayısından bağımsız" gerekçesinin aşınması. Üstelik
 * HTTP/1.1 arkasında tarayıcının origin başına 6 bağlantı kotasının yarısı
 * kalıcı akışlara gidiyordu.
 */

export type CanliOlay =
  | { tip: "mesaj"; mesajId: string; gonderenId: string; icerik: string; createdAt: string }
  | { tip: "okunmamis"; sayi: number }
  | { tip: "adim-tamamlandi"; stepId: string; baslik: string }
  /** #354: Şu an BANA yazanlar. Tam durum — artımlı değil. */
  | { tip: "yaziyor"; kimler: string[] }
  /** #380: Okunmamış bildirim sayısı. */
  | { tip: "bildirim"; okunmamis: number };

const OLAY_TIPLERI = ["mesaj", "okunmamis", "adim-tamamlandi", "yaziyor", "bildirim"] as const;

/**
 * Son abone ayrıldıktan sonra bağlantının kapatılması için beklenen süre.
 *
 * Sıfır olamaz: Next.js istemci-taraflı gezinmede bileşenler unmount olup
 * yeniden mount oluyor. Gecikme olmadan her sayfa geçişi bağlantıyı kapatıp
 * yeniden kurardı (React StrictMode'un geliştirmedeki çift mount'u da aynı
 * sonucu verir).
 */
const KAPATMA_GECIKMESI_MS = 1500;

type Dinleyici = (olay: CanliOlay) => void;
type DurumDinleyici = (bagli: boolean) => void;

const dinleyiciler = new Set<Dinleyici>();
const durumDinleyicileri = new Set<DurumDinleyici>();

let akis: EventSource | null = null;
let aboneSayisi = 0;
let bagliMi = false;
let kapatmaZamanlayici: ReturnType<typeof setTimeout> | null = null;

function durumuYay(yeni: boolean) {
  if (bagliMi === yeni) return;
  bagliMi = yeni;
  for (const d of durumDinleyicileri) d(yeni);
}

function baglantiKur() {
  if (akis) return;

  akis = new EventSource("/api/messages/stream");

  const isle = (e: MessageEvent) => {
    let olay: CanliOlay;
    try {
      olay = JSON.parse(e.data) as CanliOlay;
    } catch {
      // Bozuk bir olay akışı düşürmemeli.
      return;
    }
    // Dinleyici kopyası üzerinde geziyoruz: bir dinleyici işlenirken abonelik
    // bırakırsa (ör. yönlendirme) küme değişir ve iterasyon bozulurdu.
    for (const d of [...dinleyiciler]) {
      try {
        d(olay);
      } catch {
        // Bir tüketicinin hatası diğerlerini engellememeli.
      }
    }
  };

  for (const tip of OLAY_TIPLERI) akis.addEventListener(tip, isle as EventListener);

  akis.onopen = () => durumuYay(true);
  akis.onerror = () => {
    // EventSource kendiliğinden yeniden bağlanır; biz yalnızca durumu
    // düşürüyoruz ki tüketiciler yoklamaya geri dönsün.
    durumuYay(false);
  };
}

function baglantiyiKapat() {
  akis?.close();
  akis = null;
  durumuYay(false);
}

/** Yalnızca testler için: modül düzeyindeki paylaşımlı durumu sıfırlar. */
export function canliAkisiSifirlaForTests(): void {
  if (kapatmaZamanlayici) clearTimeout(kapatmaZamanlayici);
  kapatmaZamanlayici = null;
  akis?.close();
  akis = null;
  aboneSayisi = 0;
  bagliMi = false;
  dinleyiciler.clear();
  durumDinleyicileri.clear();
}

/**
 * @param onOlay her olayda çağrılır. Referansı değişse bile bağlantı YENİDEN
 *   KURULMAZ — aksi halde her render'da yeni bir SSE bağlantısı açılırdı.
 */
export function useCanliAkis(onOlay: (olay: CanliOlay) => void): { bagli: boolean } {
  const [bagli, setBagli] = useState(false);
  const olayRef = useRef(onOlay);
  olayRef.current = onOlay;

  useEffect(() => {
    // Sunucu tarafı render'da EventSource yok.
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const dinleyici: Dinleyici = (olay) => olayRef.current(olay);
    const durumDinleyici: DurumDinleyici = (d) => setBagli(d);

    dinleyiciler.add(dinleyici);
    durumDinleyicileri.add(durumDinleyici);
    aboneSayisi += 1;

    // Bekleyen kapatma varsa iptal: bu, sayfa geçişindeki unmount/mount
    // çiftinin bağlantıyı gereksiz yere yeniden kurmasını önlüyor.
    if (kapatmaZamanlayici) {
      clearTimeout(kapatmaZamanlayici);
      kapatmaZamanlayici = null;
    }

    baglantiKur();
    // Bağlantı zaten açıksa yeni abone açılış olayını kaçırır; durumu ona
    // doğrudan bildiriyoruz.
    setBagli(bagliMi);

    return () => {
      dinleyiciler.delete(dinleyici);
      durumDinleyicileri.delete(durumDinleyici);
      aboneSayisi -= 1;

      if (aboneSayisi <= 0) {
        aboneSayisi = 0;
        kapatmaZamanlayici = setTimeout(() => {
          kapatmaZamanlayici = null;
          if (aboneSayisi === 0) baglantiyiKapat();
        }, KAPATMA_GECIKMESI_MS);
      }
    };
  }, []);

  return { bagli };
}
