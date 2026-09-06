"use client";

import { useEffect, useRef, useState } from "react";
import { liderSecimiBaslat, type LiderKontrol } from "./lider-sekme";

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
 *
 * ⚠️ BAĞLANTI ARTIK SEKME BAŞINA DA DEĞİL, KULLANICI BAŞINA (#523).
 * #358 sekme İÇİNDEKİ çokluğu çözmüştü ama sekme SAYISINI çözmemişti:
 * altı sekme açan kullanıcıda kota tamamen dolup uygulama KİLİTLENİYORDU.
 * Ölçüldü — beşinci sekmeye kadar hiçbir yavaşlama yok, altıncıda istek hiç
 * başlamıyor. Artık sekmelerden biri "lider" seçiliyor, akışı yalnız o
 * kuruyor ve olayları `BroadcastChannel` ile diğerlerine dağıtıyor
 * (`lider-sekme.ts`).
 *
 * ⚠️ LİDER DEĞİŞİMİNDE KÜÇÜK BİR BOŞLUK VAR ve kabul edildi. Yeni lider
 * taze bir akış kuruyor; sunucu imleci bağlantı anından başlattığı için
 * (`canli-akis.ts`) devir sırasında geçen bir olay kaçabilir. Alternatifi
 * olayları sekmeler arası kuyruklamaktı — kozmetik bir rozet için
 * taşınamayacak kadar karmaşık. Yoklama yedeği (`bagli === false`) bu
 * boşluğu zaten kapatıyor.
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

let lider: LiderKontrol | null = null;

function durumuYay(yeni: boolean) {
  if (bagliMi === yeni) return;
  bagliMi = yeni;
  for (const d of durumDinleyicileri) d(yeni);
  // Lider isek takipçi sekmeler de bilsin (yoklamaya düşüp düşmeyeceklerine
  // buna bakarak karar veriyorlar).
  lider?.durumYay(yeni);
}

/** Olayı bu sekmedeki tüketicilere dağıtır. */
function olayiDagit(olay: CanliOlay) {
  // Dinleyici kopyası üzerinde geziyoruz: bir dinleyici işlenirken abonelik
  // bırakırsa (ör. yönlendirme) küme değişir ve iterasyon bozulurdu.
  for (const d of [...dinleyiciler]) {
    try {
      d(olay);
    } catch {
      // Bir tüketicinin hatası diğerlerini engellememeli.
    }
  }
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
    olayiDagit(olay);
    // Lider isek aynı olayı diğer sekmelere de ilet.
    lider?.olayYay(olay);
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

/**
 * İlk abone geldiğinde çağrılır: lider seçimini başlatır.
 *
 * ⚠️ `liderSecimiBaslat` `null` dönerse (BroadcastChannel yok) ESKİ
 * DAVRANIŞA düşülür — bu sekme kendi akışını kurar. Seçim yapılamadığı için
 * hiç bağlanmamak, mesajlaşmayı tamamen öldürürdü.
 */
function akisiBaslat() {
  if (lider) return;

  lider = liderSecimiBaslat({
    liderOldu: () => baglantiKur(),
    liderlikBitti: () => {
      // Liderliği bırakan sekme bağlantısını KAPATIR; olayları artık yeni
      // liderden alacak. Durumu düşürmüyoruz: bağlantı yeni liderde açık.
      akis?.close();
      akis = null;
    },
    olayGeldi: (yuk) => olayiDagit(yuk as CanliOlay),
    durumGeldi: (b) => {
      if (bagliMi === b) return;
      bagliMi = b;
      for (const d of durumDinleyicileri) d(b);
    },
  });

  if (!lider) baglantiKur();
}

function akisiDurdur() {
  lider?.durdur();
  lider = null;
  baglantiyiKapat();
}

/** Yalnızca testler için: modül düzeyindeki paylaşımlı durumu sıfırlar. */
export function canliAkisiSifirlaForTests(): void {
  if (kapatmaZamanlayici) clearTimeout(kapatmaZamanlayici);
  kapatmaZamanlayici = null;
  lider?.durdur();
  lider = null;
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

    akisiBaslat();
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
          if (aboneSayisi === 0) akisiDurdur();
        }, KAPATMA_GECIKMESI_MS);
      }
    };
  }, []);

  return { bagli };
}
