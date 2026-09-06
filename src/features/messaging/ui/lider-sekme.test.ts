// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { liderSecimiBaslat, KALP_MS, LIDER_OLU_MS } from "./lider-sekme";

/**
 * #523 — sekmeler arası TEK bağlantı.
 *
 * ⚠️ NEDEN VAR: `/api/messages/stream` her sekmede kalıcı açık bir bağlantı
 * tutuyor ve HTTP/1.1'de tarayıcının origin başına kotası 6. Ölçüldü —
 * beşinci sekmeye kadar hiçbir yavaşlama yok, ALTINCIDA istek hiç
 * başlamıyor. Belirti hata gibi de görünmüyor: sayfa beyaz kalıyor,
 * konsolda hata yok, sunucu logu temiz.
 */

/**
 * Aynı adı paylaşan sahte `BroadcastChannel`'lar — bir tarayıcıdaki
 * sekmeleri temsil ediyor. Gerçeğinde olduğu gibi GÖNDERENE geri vermez.
 */
class SahteKanal {
  static kanallar = new Map<string, Set<SahteKanal>>();
  onmessage: ((e: MessageEvent) => void) | null = null;
  kapandi = false;

  constructor(public ad: string) {
    if (!SahteKanal.kanallar.has(ad)) SahteKanal.kanallar.set(ad, new Set());
    SahteKanal.kanallar.get(ad)!.add(this);
  }
  postMessage(veri: unknown) {
    // Kapalı kanal KONUŞAMAZ. (İlk sürüm bunu atlamıştı ve "sessiz ölüm"
    // testi sessizce yanlış şeyi ölçüyordu: susturulan lider kalp atmaya
    // devam ediyordu.)
    if (this.kapandi) return;
    for (const k of SahteKanal.kanallar.get(this.ad) ?? []) {
      if (k === this || k.kapandi) continue;
      k.onmessage?.({ data: veri } as MessageEvent);
    }
  }
  close() {
    this.kapandi = true;
    SahteKanal.kanallar.get(this.ad)?.delete(this);
  }
  static sifirla() {
    SahteKanal.kanallar.clear();
  }
}

/**
 * Bir sekmenin kancalarını sayan yardımcı.
 *
 * O sekmenin kanalı da döndürülüyor: "sessiz ölüm" senaryosunda sekmeyi
 * veda ettirmeden susturmanın tek yolu bu.
 */
function sekmeAc() {
  const izler = { kuruldu: 0, kapandi: 0, olaylar: [] as unknown[], durumlar: [] as boolean[] };
  const oncekiler = new Set(SahteKanal.kanallar.get(KANAL_ADI) ?? []);
  const kontrol = liderSecimiBaslat({
    liderOldu: () => izler.kuruldu++,
    liderlikBitti: () => izler.kapandi++,
    olayGeldi: (y) => izler.olaylar.push(y),
    durumGeldi: (b) => izler.durumlar.push(b),
  });
  const kanal = [...(SahteKanal.kanallar.get(KANAL_ADI) ?? [])].find((k) => !oncekiler.has(k))!;
  return { izler, kontrol: kontrol!, kanal };
}

const KANAL_ADI = "aisigner-canli-akis";

describe("lider seçimi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    SahteKanal.sifirla();
    vi.stubGlobal("BroadcastChannel", SahteKanal);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("⚠️ TEK sekme HEMEN lider olur — gecikme YOK", () => {
    const a = sekmeAc();

    // Olağan durum tek sekmedir; "önce sor, yanıt bekle" tasarımı tam da bu
    // duruma gecikme eklerdi ve bu yüzden reddedildi.
    expect(a.izler.kuruldu).toBe(1);
    expect(a.kontrol.liderMiyim()).toBe(true);

    a.kontrol.durdur();
  });

  it("⚠️ İKİ sekmeden yalnız BİRİ lider kalır — çakışma küçük kimlik lehine çözülür", () => {
    const a = sekmeAc();
    const b = sekmeAc();

    // İkisi de iyimser davranıp lider oldu; bir gidiş-dönüşte biri çekildi.
    const liderSayisi = [a, b].filter((s) => s.kontrol.liderMiyim()).length;
    expect(liderSayisi).toBe(1);

    // Çekilen sekme akışını KAPATTI — açık kalsaydı düzeltmeye çalıştığımız
    // sorunun ta kendisi olurdu.
    const cekilen = a.kontrol.liderMiyim() ? b : a;
    expect(cekilen.izler.kapandi).toBe(1);

    a.kontrol.durdur();
    b.kontrol.durdur();
  });

  it("⚠️ ALTI sekmede de tek bağlantı kalır — ölçülen duvarın sebebi buydu", () => {
    const sekmeler = Array.from({ length: 6 }, () => sekmeAc());

    expect(sekmeler.filter((s) => s.kontrol.liderMiyim()).length).toBe(1);

    for (const s of sekmeler) s.kontrol.durdur();
  });

  it("lider olayları takipçilere dağıtır", () => {
    const a = sekmeAc();
    const b = sekmeAc();
    const lider = a.kontrol.liderMiyim() ? a : b;
    const takipci = lider === a ? b : a;

    lider.kontrol.olayYay({ tip: "okunmamis", sayi: 3 });

    expect(takipci.izler.olaylar).toEqual([{ tip: "okunmamis", sayi: 3 }]);
    // Lider kendi yaydığını geri almaz.
    expect(lider.izler.olaylar).toEqual([]);

    a.kontrol.durdur();
    b.kontrol.durdur();
  });

  it("⚠️ bağlantı DURUMU da yayılır — takipçi yoklamaya düşmeyi buna bakarak bilir", () => {
    const a = sekmeAc();
    const b = sekmeAc();
    const lider = a.kontrol.liderMiyim() ? a : b;
    const takipci = lider === a ? b : a;

    lider.kontrol.durumYay(true);

    expect(takipci.izler.durumlar).toEqual([true]);

    a.kontrol.durdur();
    b.kontrol.durdur();
  });

  it("⚠️ takipçi YAYMAZ — yalnız lider konuşur", () => {
    const a = sekmeAc();
    const b = sekmeAc();
    const takipci = a.kontrol.liderMiyim() ? b : a;
    const lider = takipci === a ? b : a;

    takipci.kontrol.olayYay({ tip: "okunmamis", sayi: 9 });

    expect(lider.izler.olaylar).toEqual([]);

    a.kontrol.durdur();
    b.kontrol.durdur();
  });

  it("⚠️ lider kapanınca BAŞKASI devralır — vedasıyla, beklemeden", () => {
    const a = sekmeAc();
    const b = sekmeAc();
    const lider = a.kontrol.liderMiyim() ? a : b;
    const digeri = lider === a ? b : a;

    lider.kontrol.durdur();
    // "Veda" duyulduğu için bir sonraki tikte devralınır; LIDER_OLU_MS
    // beklenmez — kullanıcı son sekmesini kapatınca akış saniyelerce
    // ölü kalmamalı.
    vi.advanceTimersByTime(KALP_MS);

    expect(digeri.kontrol.liderMiyim()).toBe(true);

    digeri.kontrol.durdur();
  });

  it("⚠️ lider SESSİZCE ölürse (veda EDEMEDEN) yine devralınır", () => {
    const a = sekmeAc();
    const b = sekmeAc();
    const lider = a.kontrol.liderMiyim() ? a : b;
    const digeri = lider === a ? b : a;

    /*
     * ⚠️ `durdur()` ÇAĞIRMIYORUZ — o veda yolluyor ve sessiz ölümü değil,
     * düzgün kapanışı sınardı (bir önceki test onu kapsıyor). Burada
     * çökme/uyku taklit ediliyor: liderin kanalı konuşamaz hale getiriliyor,
     * hiçbir haber gitmiyor.
     */
    lider.kanal.kapandi = true;

    // Takipçi yalnızca SESSİZLİĞE bakarak devralmalı.
    vi.advanceTimersByTime(LIDER_OLU_MS + KALP_MS);

    expect(digeri.kontrol.liderMiyim()).toBe(true);

    digeri.kontrol.durdur();
  });

  it("⚠️ BroadcastChannel yoksa null döner — çağıran ESKİ davranışa düşer", () => {
    vi.stubGlobal("BroadcastChannel", undefined);

    const kontrol = liderSecimiBaslat({
      liderOldu: () => {},
      liderlikBitti: () => {},
      olayGeldi: () => {},
      durumGeldi: () => {},
    });

    // Seçim yapılamadığı için hiç bağlanmamak mesajlaşmayı TAMAMEN
    // öldürürdü; altı sekme sınırına takılmak bundan iyidir.
    expect(kontrol).toBeNull();
  });
});
