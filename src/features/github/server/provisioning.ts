import { after } from "next/server";
import { takilmaEsigi } from "@/features/github/kurulum-durumu";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { logger } from "@/lib/logger";
import { readGitHubConfig } from "./client";
import { atamayiYukle, mesajUret } from "./provisioning-yardimcilar";
export { milestoneNumarasiCikar } from "./provisioning-yardimcilar";
import { issueIcerikleriniUret, simulasyonlaKur, gercektenKur } from "./provisioning-adimlar";
import { DIS_DEPO_DURUMU } from "@/features/proposals/server/oneri";

/**
 * GitHub çalışma alanı kurulumu ve güncellenmesi.
 *
 * #257: Artık GERÇEK GitHub API'sini kullanabiliyor. `GITHUB_TOKEN` tanımlıysa
 * repo, milestone ve issue'lar gerçekten oluşturulur. Token yoksa sistem
 * kırılmaz: #178-1'deki simülasyona düşer, URL'ler yalnızca türetilir ve
 * sonuç bunun bir önizleme olduğunu açıkça söyler.
 *
 * Kurulum ve güncelleme AYNI kodu paylaşır; tek fark raporlanan mesaj.
 * Tüm GitHub işlemleri idempotent olduğu için (#255) güncelleme, var olanları
 * atlayıp eksikleri tamamlamak demektir — repo kopya issue'larla dolmaz.
 */

/**
 * Kurulum zaten sürerken ikinci kez başlatılmaya çalışıldı.
 *
 * Ayrı bir tip: çağıran route bunu 500 (sunucu hatası) değil **409 Conflict**
 * olarak yanıtlamalı — istek geçerli, yalnızca şu an uygun bir durum değil.
 */
export class KurulumZatenSuruyorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KurulumZatenSuruyorError";
  }
}

/** Arka plana alınan kurulumun BAŞLATMA yanıtı (işin kendisi değil). */
export type KurulumBaslatmaSonucu = {
  started: true;
  /** #178-1: true ise GitHub'da fiziksel bir şey oluşturulmayacak. */
  simulated: boolean;
  guncelleme: boolean;
  message: string;
};

export type ProvisioningResult = {
  success: boolean;
  githubRepoUrl: string;
  createdMilestonesCount: number;
  createdIssuesCount: number;
  message: string;
  /** #178-1: true ise GitHub'da fiziksel bir şey oluşturulmadı. */
  simulated: boolean;
  /** İlk kurulum mu, mevcut çalışma alanının güncellenmesi mi. */
  guncelleme: boolean;
};


/**
 * Yetkilendirme kapısı.
 *
 * requireAuth hata FIRLATMAZ, `{ authorized }` döndürür — dönüş değeri kontrol
 * edilmezse bu kontrol işlevsizdir. Çağıran route zaten ADMIN kontrolü yapsa da,
 * bu modül başka bir yerden çağrılırsa korumasız kalmasın diye burada da
 * açıkça reddediyoruz.
 */
async function yoneticiOlduguDogrula(): Promise<void> {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.authorized) {
    throw new Error("Bu işlem için yönetici yetkisi gerekiyor");
  }
}

async function senkronizeEt(
  assignmentId: string,
  guncelleme: boolean,
): Promise<ProvisioningResult> {
  await yoneticiOlduguDogrula();
  return isiYurut(assignmentId, guncelleme);
}

/**
 * Asıl iş. YETKİ KONTROLÜ YAPMAZ — çağıranlar (`senkronizeEt` ve
 * `baslatGitHubWorkspaceKurulumu`) yetkilendirmeyi kendileri yapar.
 *
 * Neden ayrıldı: arka planda `after()` içinde koşarken istek bağlamına (çerez/
 * başlık) güvenmek istemiyoruz. Yetki, isteği yanıtlamadan ÖNCE doğrulanıyor;
 * arka plan işi yalnızca o kapıdan geçmiş çağrılarla başlatılabiliyor.
 */
async function isiYurut(
  assignmentId: string,
  guncelleme: boolean,
): Promise<ProvisioningResult> {
  const assignment = await atamayiYukle(assignmentId);
  if (!assignment) {
    throw new Error("Proje ataması bulunamadı");
  }

  if (!assignment.roadmap || assignment.roadmap.steps.length === 0) {
    throw new Error("Bu projeye ait onaylanmış bir Roadmap ve adım bulunmuyor");
  }

  // Güncellemede mevcut durumu hatırla: işlem yarıda kalırsa PROVISIONED
  // durumunu kaybetmeyelim — repo GitHub'da duruyor olacak.
  const oncekiDurum = assignment.githubStatus;
  const oncekiUrl = assignment.githubRepoUrl;

  await prisma.assignedProject.update({
    where: { id: assignmentId },
    data: { githubStatus: "PROVISIONING" },
  });

  try {
    await issueIcerikleriniUret(assignment);

    const config = readGitHubConfig();

    /*
     * #179: ÜRETİMDE simülasyona düşülmez.
     *
     * Simülasyon veritabanına SAHTE veri yazıyor: repo ve issue URL'leri
     * `RoadmapStep.githubIssueUrl` ile `StepIssue.githubIssueUrl` alanlarına
     * kaydediliyor, atama `PROVISIONED` damgası alıyor. Token'ı olmayan bir
     * üretim ortamında bu sessizce oluyordu; admin "oluşturuldu" görüyor,
     * öğrenci panelinde 404 veren bağlantılara tıklıyor ve kayıt sonradan
     * gerçek kurulumdan AYIRT EDİLEMİYORDU.
     *
     * Bu yüzden üretimde eksik yapılandırma sessiz bir yedek değil, gürültülü
     * bir hata. (`AUTH_SECRET` için `nextauth.ts`'te aynı yaklaşım var.)
     *
     * Geliştirmede simülasyon KORUNUYOR: token'ı olmayan ortamda uygulama
     * çalışmayı sürdürmeli — `client.ts`'in sözleşmesi bu.
     */
    if (config === null && process.env.NODE_ENV === "production") {
      throw new Error(
        "GitHub entegrasyonu yapılandırılmamış: GITHUB_TOKEN tanımlı değil. " +
          "Üretimde önizleme modu devre dışıdır; sahte repo bağlantıları kaydedilmez.",
      );
    }

    const simulated = config === null;

    const sonuc = simulated
      ? await simulasyonlaKur(assignment)
      : await gercektenKur(assignment, config);

    await prisma.assignedProject.update({
      where: { id: assignmentId },
      data: {
        githubRepoUrl: sonuc.githubRepoUrl,
        githubStatus: "PROVISIONED",
        provisionedAt: new Date(),
        status: "IN_PROGRESS",
      },
    });

    logger.info(
      guncelleme ? "GitHub workspace güncellendi" : "GitHub workspace oluşturuldu",
      { assignmentId, githubRepoUrl: sonuc.githubRepoUrl, simulated },
    );

    return {
      success: true,
      simulated,
      guncelleme,
      ...sonuc,
      message: mesajUret({ ...sonuc, simulated, guncelleme }),
    };
  } catch (error) {
    logger.error("GitHub workspace işlemi başarısız", {
      assignmentId,
      guncelleme,
      error,
    });

    // Zaten kurulmuş bir çalışma alanını ERROR'a düşürmek geri adım olurdu:
    // repo GitHub'da duruyor, yalnızca güncelleme başarısız oldu.
    const geriDonulecekDurum =
      guncelleme && oncekiDurum === "PROVISIONED" ? "PROVISIONED" : "ERROR";

    await prisma.assignedProject.update({
      where: { id: assignmentId },
      data: {
        githubStatus: geriDonulecekDurum,
        ...(geriDonulecekDurum === "PROVISIONED" && oncekiUrl
          ? { githubRepoUrl: oncekiUrl }
          : {}),
      },
    });

    throw new Error(
      error instanceof Error
        ? error.message
        : "GitHub çalışma alanı işlenirken beklenmeyen bir hata oluştu",
    );
  }
}

/** İlk kurulum. */
export async function provisionGitHubWorkspace(
  assignmentId: string,
): Promise<ProvisioningResult> {
  return senkronizeEt(assignmentId, false);
}

/**
 * Mevcut çalışma alanını yol haritasıyla yeniden senkronize eder.
 * Var olan repo/milestone/issue atlanır, yalnızca eksikler tamamlanır.
 */
export async function updateGitHubWorkspace(
  assignmentId: string,
): Promise<ProvisioningResult> {
  return senkronizeEt(assignmentId, true);
}

/**
 * PERFORMANS + DAYANIKLILIK: kurulumu HTTP isteğinden çıkarır.
 *
 * Sorun neydi: `POST /api/admin/assignments` tüm zinciri bekliyordu — adım
 * başına bir Gemini çağrısı, ardından repo + adım başına milestone + issue
 * başına bir GitHub çağrısı, hepsi seri. Sıradan bir yol haritasında bu 30
 * saniyeyi aşabiliyor; GitHub'ın yeniden deneme beklemeleri (30 sn'ye kadar)
 * eklendiğinde platformun istek zaman aşımına çarpıyor. İstek koparsa admin
 * hata görüyor ama iş sunucuda yarıda kalıyordu.
 *
 * Şimdi: doğrulama ve yetkilendirme İSTEK İÇİNDE yapılır (admin yanlış bir
 * şey denediyse anında öğrenir), durum `PROVISIONING`'e çekilir, yanıt hemen
 * döner ve asıl iş `after()` ile arka planda koşar.
 *
 * ⚠️ Süreç yeniden başlarsa (deploy) arka plan işi yarıda kalır ve atama
 * `PROVISIONING`'de asılı kalır. Bilinçli takas: kurtarma otomatik değil,
 * admin panelinden "Tekrar Dene" ile yapılır — ek bir kolon/migration
 * gerektirmiyor ve admin zaten o ekranda.
 */
export async function baslatGitHubWorkspaceKurulumu(
  assignmentId: string,
  guncelleme: boolean,
): Promise<KurulumBaslatmaSonucu> {
  await yoneticiOlduguDogrula();

  const atama = await prisma.assignedProject.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      // githubStatus artık BURADAN okunmuyor: çift tetikleme koruması aşağıda
      // atomik `updateMany` ile yapılıyor. Buradan okumak, karar ile yazma
      // arasında yarış penceresi bırakırdı.
      roadmap: { select: { steps: { select: { id: true }, take: 1 } } },
    },
  });

  if (!atama) {
    throw new Error("Proje ataması bulunamadı");
  }

  if (!atama.roadmap || atama.roadmap.steps.length === 0) {
    throw new Error("Bu projeye ait onaylanmış bir Roadmap ve adım bulunmuyor");
  }

  // Yapılandırma kontrolü kilitten ÖNCE: burada fırlatırsak kaydı
  // `PROVISIONING`'de asılı bırakmamış oluruz.
  //
  // Kontrolün İSTEK İÇİNDE olması bilinçli: eksik token'ı arka planda sessiz bir
  // hataya çevirmek yerine admin'e anında söylüyoruz (#179 ile aynı gerekçe).
  const config = readGitHubConfig();
  if (config === null && process.env.NODE_ENV === "production") {
    throw new Error(
      "GitHub entegrasyonu yapılandırılmamış: GITHUB_TOKEN tanımlı değil. " +
        "Üretimde önizleme modu devre dışıdır; sahte repo bağlantıları kaydedilmez.",
    );
  }
  const simulated = config === null;

  /*
   * #318: ÇİFT TETİKLEME KORUMASI ATOMİK OLMALI.
   *
   * Öncesi klasik bir "check-then-act" idi: durum `findUnique` ile okunuyor,
   * ayrı bir `update` ile yazılıyordu. İki EŞZAMANLI istek arada kalır — ikisi
   * de `NOT_PROVISIONED` okur, ikisi de kontrolden geçer, iki arka plan işi
   * başlar ve GitHub'a mükerrer repo/issue istekleri gider.
   *
   * (#313'te 409 koruması eklenmişti ama ARDIŞIK isteklerle test edildiği için
   * bu boşluk görünmemişti.)
   *
   * Çözüm: okuma ve yazma tek bir atomik ifadede. `updateMany` koşulu
   * veritabanı seviyesinde değerlendirir; yalnızca BİR istek satırı
   * güncelleyebilir, diğerinin `count`'u 0 döner.
   */
  const kilit = await prisma.assignedProject.updateMany({
    where: {
      id: assignmentId,
      // #366: DIŞ DEPOYA ASLA DOKUNMA — her koşulda dışarıda.
      //
      // `LINKED`, stajyerin kendi deposunun bu atamaya bağlandığı anlamına
      // geliyor (öneri akışında "var olan depomu bağla" / "devrettim").
      // Kurulum çalışsaydı BAŞKASININ deposuna milestone ve issue açardı.
      // Bu kayıt TAKILMIŞ olsa bile geri alınmaz.
      githubStatus: { not: DIS_DEPO_DURUMU },
      OR: [
        // Normal yol: sürmekte olan bir kurulum yok.
        { githubStatus: { not: "PROVISIONING" } },
        /*
         * ⚠️ TAKILMIŞ KURULUM GERİ ALINABİLİR (#483).
         *
         * Önceki koşul `PROVISIONING`'i koşulsuz dışlıyordu. Süreç yeniden
         * başlarsa (deploy) iş yarıda kalıyor, durumu `ERROR`'a çekecek kod
         * da o süreçle ölüyor ve atama `PROVISIONING`'de SONSUZA DEK asılı
         * kalıyordu — bu kilit yüzünden "Tekrar Dene" de reddediliyordu.
         * Docstring kurtarmanın admin panelinden yapıldığını söylüyordu ama
         * o yol gerçekte yoktu.
         *
         * Eşik cömert: `isiYurut` ara güncelleme yapmadığı için canlı bir iş
         * `updatedAt`'i tazelemiyor; kısa bir eşik ÇALIŞAN kurulumun üstüne
         * ikincisini başlatırdı.
         */
        { githubStatus: "PROVISIONING", updatedAt: { lt: takilmaEsigi() } },
      ],
    },
    data: { githubStatus: "PROVISIONING" },
  });

  if (kilit.count === 0) {
    // Dış depoyu ayırt et: "kurulum sürüyor" demek yanıltıcı olurdu.
    const mevcut = await prisma.assignedProject.findUnique({
      where: { id: assignmentId },
      select: { githubStatus: true },
    });
    if (mevcut?.githubStatus === DIS_DEPO_DURUMU) {
      throw new Error(
        "Bu atama mevcut bir GitHub deposuna bağlı; çalışma alanı kurulumu yapılmaz.",
      );
    }
    throw new KurulumZatenSuruyorError(
      "Bu çalışma alanı için bir kurulum zaten sürüyor. Tamamlanmasını bekleyin.",
    );
  }

  after(async () => {
    try {
      await isiYurut(assignmentId, guncelleme);
    } catch (error) {
      // `isiYurut` durumu zaten ERROR'a yazıp hatayı yeniden fırlatıyor.
      // Arka planda yakalanmayan bir reddi süreç seviyesine taşımayalım.
      logger.error("Arka plan GitHub kurulumu başarısız", {
        assignmentId,
        guncelleme,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return {
    started: true,
    simulated,
    guncelleme,
    message: guncelleme
      ? "Çalışma alanı güncellemesi başlatıldı. İşlem arka planda sürüyor."
      : simulated
        ? "Çalışma alanı önizlemesi hazırlanıyor. İşlem arka planda sürüyor."
        : "GitHub çalışma alanı kurulumu başlatıldı. İşlem arka planda sürüyor.",
  };
}
