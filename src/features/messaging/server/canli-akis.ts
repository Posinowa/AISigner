import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { yazanlariGetir } from "./yaziyor";

/**
 * Canlı akış merkezi (#329).
 *
 * ⚠️ MİMARİ KARAR — NEDEN "GERÇEK PUSH" DEĞİL:
 *
 * #322, rate-limit sayaçlarını Postgres'e taşıdı ve gerekçesi açıktı: sistem
 * ÇOK INSTANCE çalışacak. Bu, süreç-belleğinde tutulan bir yayın listesiyle
 * SSE yapmayı elemiyor gibi görünse de eliyor: A pod'una yazılan bir mesaj,
 * B pod'una bağlı istemciye asla ulaşmaz. Lokalde kusursuz çalışır, üretimde
 * kullanıcıların yarısı mesaj almaz — ve bu hiçbir yerde hata olarak görünmez.
 *
 * Değerlendirilen üç seçenek:
 *
 * 1. Süreç-yerel yayın listesi → ÇOK INSTANCE'TA SESSİZCE BOZULUR. Elendi.
 * 2. Postgres LISTEN/NOTIFY → gerçek push, ama `pg` bağımlılığı + Prisma
 *    havuzunun dışında uzun ömürlü ayrı bir bağlantı + yeniden bağlanma
 *    yönetimi gerektiriyor. Üstelik NOTIFY ateşle-unut olduğu için bağlantı
 *    koptuğunda o aralıktaki olaylar KAYBOLUR; yine de bir "yakalama"
 *    sorgusu yazmak gerekirdi.
 * 3. SUNUCU TARAFI TARAMA (seçilen) → her pod TEK bir sorguyla kendi bağlı
 *    istemcilerinin olaylarını okur ve dağıtır.
 *
 * Seçenek 3'ün dürüst tarifi: bu "push" değil, YOKLAMANIN YER DEĞİŞTİRMESİ.
 * Kazanç yine de büyük ve asıl şikâyet buydu:
 *
 *   Önce:  her açık panel 5 sn'de bir + her sayfa 15 sn'de bir istek.
 *          50 kullanıcı ≈ 800 istek/dk, her biri ayrı HTTP + ayrı sorgu.
 *   Sonra: kullanıcı başına 1 kalıcı bağlantı; pod başına tik başına 1 sorgu
 *          — kullanıcı sayısından BAĞIMSIZ. 2 sn'lik tikte 30 sorgu/dk.
 *
 * Yakalama (catch-up) da bedava geliyor: imleç zaman tabanlı olduğu için
 * kopan bir bağlantı yeniden bağlandığında aradaki olayları görür.
 * LISTEN/NOTIFY'a geçilecekse bu modülün ARAYÜZÜ korunabilir; değişecek olan
 * yalnızca `tikAt`'ın tetiklenme biçimidir.
 */

export type CanliOlay =
  | { tip: "mesaj"; mesajId: string; gonderenId: string; icerik: string; createdAt: string }
  | { tip: "okunmamis"; sayi: number }
  | { tip: "adim-tamamlandi"; stepId: string; baslik: string }
  /**
   * #354: Şu an BANA yazanların kimlikleri. Liste tam durum olarak gider,
   * artımlı değil: kaçan tek bir "bıraktı" olayı göstergeyi sonsuza dek
   * açık bırakırdı.
   */
  | { tip: "yaziyor"; kimler: string[] };

type Abone = {
  userId: string;
  gonder: (olay: CanliOlay) => void;
  /** Bu bağlantıya iletilmiş mesaj kimlikleri — çakışma penceresinde kopya olmasın. */
  gorulen: Set<string>;
};

/** Tik aralığı. Gecikme ile veritabanı yükü arasındaki denge. */
const TIK_MS = 2000;

/**
 * İmleç geriye çekme payı.
 *
 * Sorgu ile imleç güncellemesi arasında yazılan bir kayıt aksi halde atlanırdı.
 * Pencere içindeki kopyalar `Abone.gorulen` ile eleniyor.
 */
const CAKISMA_MS = 1500;

/** Bellek sızıntısı olmasın: kopya elemesi için tutulan kimlik sayısı. */
const GORULEN_SINIRI = 200;

const aboneler = new Map<string, Set<Abone>>();
let zamanlayici: ReturnType<typeof setInterval> | null = null;
let sonZaman = new Date();
/** Kullanıcı başına en son gönderilen okunmamış sayısı — değişmedikçe yollamayız. */
const sonOkunmamis = new Map<string, number>();
/**
 * #354: Kullanıcı başına en son gönderilen "yazıyor" kümesi.
 *
 * Değişmedikçe yollamıyoruz; aksi halde biri yazarken KARŞI TARAFA 2 saniyede
 * bir olay giderdi — akışın "olay olunca konuş" davranışı yoklamaya dönerdi.
 */
const sonYazanlar = new Map<string, string>();

export function aboneOl(abone: Abone): () => void {
  let kume = aboneler.get(abone.userId);
  if (!kume) {
    kume = new Set();
    aboneler.set(abone.userId, kume);
  }
  kume.add(abone);

  // İlk abonede döngü başlar: kimse bağlı değilken boş yere sorgu atmayalım.
  if (!zamanlayici) {
    sonZaman = new Date();
    zamanlayici = setInterval(() => {
      void tikAt();
    }, TIK_MS);
  }

  return () => {
    kume!.delete(abone);
    if (kume!.size === 0) {
      aboneler.delete(abone.userId);
      sonOkunmamis.delete(abone.userId);
      sonYazanlar.delete(abone.userId);
    }
    // Son abone de gittiyse döngüyü durdur.
    if (aboneler.size === 0 && zamanlayici) {
      clearInterval(zamanlayici);
      zamanlayici = null;
    }
  };
}

/** Yalnızca testler için. */
export function akisiSifirla(): void {
  if (zamanlayici) clearInterval(zamanlayici);
  zamanlayici = null;
  aboneler.clear();
  sonOkunmamis.clear();
  sonYazanlar.clear();
  sonZaman = new Date();
}

function yayinla(userId: string, olay: CanliOlay): void {
  const kume = aboneler.get(userId);
  if (!kume) return;
  for (const a of kume) {
    if (olay.tip === "mesaj") {
      if (a.gorulen.has(olay.mesajId)) continue;
      a.gorulen.add(olay.mesajId);
      // Sınırsız büyümesin: en eskiyi at.
      if (a.gorulen.size > GORULEN_SINIRI) {
        a.gorulen.delete(a.gorulen.values().next().value as string);
      }
    }
    try {
      a.gonder(olay);
    } catch {
      // Kapanmış bir bağlantıya yazmak diğerlerini etkilememeli.
    }
  }
}

/**
 * Bir tik: bağlı kullanıcılar için yeni olayları okuyup dağıtır.
 *
 * HATA YUTULUR: tek bir başarısız tik akışı sonlandırmamalı — istemci tarafı
 * zaten bağlantı kopmasında yoklamaya geri düşüyor.
 */
export async function tikAt(): Promise<void> {
  const kullanicilar = [...aboneler.keys()];
  if (kullanicilar.length === 0) return;

  const pencereBasi = new Date(sonZaman.getTime() - CAKISMA_MS);
  const simdi = new Date();

  try {
    // 1) Yeni mesajlar — TEK sorgu, kullanıcı sayısından bağımsız.
    const mesajlar = await prisma.message.findMany({
      where: { receiverId: { in: kullanicilar }, createdAt: { gt: pencereBasi } },
      select: { id: true, senderId: true, receiverId: true, content: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    for (const m of mesajlar) {
      yayinla(m.receiverId, {
        tip: "mesaj",
        mesajId: m.id,
        gonderenId: m.senderId,
        icerik: m.content,
        createdAt: m.createdAt.toISOString(),
      });
    }

    // 2) Okunmamış sayacı — DEĞİŞTİĞİNDE yollanır.
    //
    // Mesaj gelmesi dışında "okundu" işaretlenmesiyle de değişir; bu yüzden
    // mesaj olayına bağlamak yerine ayrıca sayılıyor. `groupBy` sıfır dönen
    // kullanıcıyı hiç listelemez, o yüzden aşağıda sıfırla dolduruyoruz.
    const sayimlar = await prisma.message.groupBy({
      by: ["receiverId"],
      where: { receiverId: { in: kullanicilar }, isRead: false },
      _count: { _all: true },
    });

    const sayiHaritasi = new Map(sayimlar.map((s) => [s.receiverId, s._count._all]));
    for (const userId of kullanicilar) {
      const sayi = sayiHaritasi.get(userId) ?? 0;
      if (sonOkunmamis.get(userId) === sayi) continue;
      sonOkunmamis.set(userId, sayi);
      yayinla(userId, { tip: "okunmamis", sayi });
    }

    // 3) Tamamlanan adımlar — kutlama için.
    //
    // Değeri #326 ile birlikte ortaya çıkıyor: öğrenci GitHub'da issue'yu
    // kapattığında webhook adımı COMPLETED yapıyor ve öğrenci bunu sayfayı
    // yenilemeden görüyor.
    const tamamlananlar = await prisma.stepStatusHistory.findMany({
      // #358: Kullanıcı filtresi SORGUDA. Önceden platformdaki TÜM tamamlanma
      // kayıtları çekilip JS tarafında eleniyordu; `take` sınırı yüzünden bağlı
      // bir öğrencinin tamamlaması ilgisiz kayıtların arkasında kalıp
      // KAÇIRILABİLİRDİ — kutlama hiç görünmezdi.
      where: {
        toStatus: "COMPLETED",
        createdAt: { gt: pencereBasi },
        step: {
          roadmap: {
            assignedProject: {
              // #332: Bireysel VEYA takım üyeliği üzerinden.
              OR: [
                { studentProfile: { userId: { in: kullanicilar } } },
                {
                  team: {
                    members: {
                      some: { leftAt: null, studentProfile: { userId: { in: kullanicilar } } },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      select: {
        stepId: true,
        step: {
          select: {
            title: true,
            roadmap: {
              select: {
                // #332: Adım takıma ait olabilir — kutlama TÜM aktif
                // üyelere gider, yalnız birine değil.
                assignedProject: {
                  select: {
                    studentProfile: { select: { userId: true } },
                    team: {
                      select: {
                        members: {
                          where: { leftAt: null },
                          select: { studentProfile: { select: { userId: true } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      take: 50,
    });

    for (const t of tamamlananlar) {
      const atama = t.step.roadmap.assignedProject;
      // #332: Bireysel atamada tek kişi, takımda tüm aktif üyeler.
      const userIdler = atama.team
        ? atama.team.members.map((m) => m.studentProfile.userId)
        : atama.studentProfile
          ? [atama.studentProfile.userId]
          : [];

      for (const userId of userIdler) {
        if (!aboneler.has(userId)) continue;
        yayinla(userId, { tip: "adim-tamamlandi", stepId: t.stepId, baslik: t.step.title });
      }
    }

    // 4) #354: "Yazıyor..." — TEK sorgu, yalnızca DEĞİŞTİĞİNDE yollanır.
    //
    // Sinyalin süresi dolduğunda küme kendiliğinden boşalır ve boşalma da bir
    // değişikliktir: sekmesini kapatan kullanıcı için "yazıyor" göstergesi
    // sönsün diye ayrıca bir "bıraktı" olayına ihtiyaç yok.
    const yazanlar = await yazanlariGetir(kullanicilar);
    for (const userId of kullanicilar) {
      const kimler = (yazanlar.get(userId) ?? []).sort();
      const imza = kimler.join(",");
      if (sonYazanlar.get(userId) === imza) continue;
      sonYazanlar.set(userId, imza);
      yayinla(userId, { tip: "yaziyor", kimler });
    }

    sonZaman = simdi;
  } catch (error) {
    logger.warn("Canlı akış tiki başarısız", {
      error: error instanceof Error ? error.message : String(error),
    });
    // İmleci İLERLETMİYORUZ: bir sonraki tik aynı pencereyi yeniden dener,
    // yoksa hata anındaki mesajlar kalıcı olarak kaybolurdu.
  }
}

/** Teşhis: bu pod'a kaç bağlantı var. */
export function bagliKullaniciSayisi(): number {
  return aboneler.size;
}
