import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { generateStepIssues } from "@/features/ai/server/issue-generator";
import { logger } from "@/lib/logger";
import { readGitHubConfig, hataMesaji, type GitHubConfig } from "./client";
import { repoAdiUret, repoyuHazirla, milestoneHazirla, issueHazirla } from "./repo";

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

type Atama = NonNullable<Awaited<ReturnType<typeof atamayiYukle>>>;

function atamayiYukle(assignmentId: string) {
  return prisma.assignedProject.findUnique({
    where: { id: assignmentId },
    include: {
      studentProfile: { include: { user: true } },
      projectTemplate: true,
      roadmap: {
        include: {
          steps: { orderBy: { order: "asc" }, include: { issues: true } },
        },
      },
    },
  });
}

/**
 * #274: Repo adı ATAMAYA ÖZEL olmalı.
 *
 * Önceden yalnızca öğrenci adı + proje başlığından türetiliyordu. Adı aynı
 * olan iki öğrenci aynı projeye atandığında aynı adı üretiyorlardı; repo
 * işlemleri idempotent olduğu için ikinci öğrencinin issue'ları BİRİNCİNİN
 * reposuna açılırdı. Adı olmayanlar ("student" fallback'i) ise hepsi aynı
 * repoyu paylaşırdı.
 *
 * Sonek atama kimliğinden alınıyor: deterministik (aynı atama her zaman aynı
 * ada çözülür, idempotenslik korunur) ve atamalar arasında benzersiz.
 */
function repoAdi(atama: Atama): string {
  const kisaKimlik = atama.id.slice(-8).toLowerCase();

  return repoAdiUret([
    "aisigner",
    atama.studentProfile.user.name || "student",
    atama.projectTemplate.title,
    kisaKimlik,
  ]);
}

/**
 * Kayıtlı milestone URL'inden numarayı çıkarır (#345).
 *
 * Numarayı saklamak için ayrı bir kolon eklemek yerine var olan URL'den
 * okuyoruz: kolon eklemek yıkıcı olmayan ama gereksiz bir migration olurdu ve
 * URL zaten numarayı içeriyor. Simülasyon modunda üretilen URL'ler de aynı
 * biçimde olduğu için ayrı bir dal gerekmiyor.
 *
 * Beklenmeyen bir biçimde `null` döner — o zaman milestone yeniden hazırlanır,
 * yani en kötü ihtimalle eski davranışa düşülür.
 */
export function milestoneNumarasiCikar(url: string | null): number | null {
  if (!url) return null;
  const eslesme = /\/milestone\/(\d+)(?:$|[/?#])/.exec(url);
  if (!eslesme) return null;
  const numara = Number(eslesme[1]);
  return Number.isSafeInteger(numara) && numara > 0 ? numara : null;
}

/**
 * Yol haritası adımları için AI issue içeriklerini üretir.
 *
 * Bu adım her iki yolda da (gerçek/simülasyon) çalışır — içerikler gerçektir
 * ve DB'de saklanır; yalnızca GitHub'a gönderilmeleri yapılandırmaya bağlıdır.
 *
 * #269: GitHub'a GÖNDERİLMİŞ adımda AI HİÇ çağrılmaz. Üç nedeni var:
 * - `storeGeneratedIssues` kayıtları siliyor; gönderilmiş issue bağlantıları
 *   kaybolurdu
 * - AI her seferinde farklı başlık üretebiliyor; `issueHazirla` eşleştirmeyi
 *   başlığa göre yaptığı için GitHub'da KOPYA issue açılırdı
 * - gereksiz AI maliyeti ve gecikme
 *
 * Yani güncelleme, var olan adımlara dokunmadan yalnızca eksikleri tamamlıyor.
 */
async function issueIcerikleriniUret(atama: Atama): Promise<void> {
  // PERFORMANS: adımlar PARALEL işleniyor.
  //
  // Öncesi seriydi ve her adım bir Gemini çağrısı olduğu için toplam süre adım
  // sayısıyla doğrusal büyüyordu (5 adımlık bir yol haritası tek başına
  // ~25 saniye). Adımlar birbirinden bağımsız: `generateStepIssues` yalnız
  // KENDİ adımının StepIssue kayıtlarını siliyor/yazıyor, bu yüzden paralel
  // çalışmaları çakışma üretmiyor.
  await Promise.all(
    atama.roadmap!.steps.map(async (step) => {
      const gonderilmisSayisi = await prisma.stepIssue.count({
        where: { stepId: step.id, githubIssueUrl: { not: null } },
      });

      if (gonderilmisSayisi > 0) return;

      await generateStepIssues({
        stepId: step.id,
        stepTitle: step.title,
        stepDescription: step.description,
        projectTitle: atama.projectTemplate.title,
        experienceLevel: atama.studentProfile.experienceLevel,
      });
    }),
  );
}

/** #178-1 davranışı: URL'ler yalnızca türetilir, GitHub'a gidilmez. */
async function simulasyonlaKur(atama: Atama) {
  const orgName = process.env.GITHUB_ORG || "Posinowa";
  const githubRepoUrl = `https://github.com/${orgName}/${repoAdi(atama)}`;

  let createdIssuesCount = 0;

  for (const step of atama.roadmap!.steps) {
    const stepIssueUrl = `${githubRepoUrl}/issues?q=is%3Aissue+milestone%3A%22${encodeURIComponent(step.title)}%22`;
    await prisma.roadmapStep.update({
      where: { id: step.id },
      data: { githubIssueUrl: stepIssueUrl },
    });

    const stepIssues = await prisma.stepIssue.findMany({ where: { stepId: step.id } });
    for (const [index, issue] of stepIssues.entries()) {
      await prisma.stepIssue.update({
        where: { id: issue.id },
        data: { githubIssueUrl: `${githubRepoUrl}/issues/${index + 1}` },
      });
      createdIssuesCount++;
    }
  }

  return {
    githubRepoUrl,
    createdMilestonesCount: atama.roadmap!.steps.length,
    createdIssuesCount,
  };
}

/**
 * Zaten kayıtlı bir repo varsa ADINI ondan alır.
 *
 * Neden: repo adı öğrenci adı ve proje başlığından türetiliyor. Bu türetme
 * değişirse (ör. Türkçe karakter çevirisi düzeltilirse) güncelleme, var olan
 * repoyu bulamayıp YENİSİNİ açardı — öğrencinin işi eski repoda öksüz kalırdı.
 *
 * Yalnızca kayıtlı URL yapılandırılan hesaba aitse yeniden kullanılır; başka
 * bir hesabın reposunu güncellemeye çalışmak yanlış olur.
 */
function mevcutRepoAdi(atama: Atama, config: GitHubConfig): string | null {
  if (!atama.githubRepoUrl) return null;

  const eslesme = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(
    atama.githubRepoUrl,
  );
  if (!eslesme) return null;

  const [, sahip, ad] = eslesme;
  if (sahip.toLowerCase() !== config.owner.toLowerCase()) return null;

  return ad;
}

/**
 * Gerçek GitHub kurulumu.
 *
 * Sayaçlar YALNIZCA gerçekten oluşturulanları sayar; güncellemede "0 yeni"
 * demek anlamlı bir sonuçtur, her şeyin yeniden yaratıldığı izlenimi vermez.
 */
async function gercektenKur(atama: Atama, config: GitHubConfig) {
  // Kayıtlı repo varsa onu koru; yoksa addan türet.
  const repoName = mevcutRepoAdi(atama, config) ?? repoAdi(atama);

  const repo = await repoyuHazirla(config, {
    repoName,
    description: `${atama.projectTemplate.title} — ${atama.studentProfile.user.name ?? "stajyer"} (AISigner)`,
  });
  if (!repo.ok) throw new Error(hataMesaji(repo.neden));

  const githubRepoUrl = repo.veri.htmlUrl;
  let createdMilestonesCount = 0;
  let createdIssuesCount = 0;

  for (const step of atama.roadmap!.steps) {
    const stepIssues = await prisma.stepIssue.findMany({ where: { stepId: step.id } });

    // #345: GÖNDERİLMİŞ KAYITLAR YENİDEN GÖNDERİLMEZ.
    //
    // Öncesi her çalıştırmada bütün issue'ları `issueHazirla`'ya veriyor ve
    // kopya oluşmasını onun BAŞLIK TARAMASINA bırakıyordu. O tarama
    // güvenilir değil: GitHub'ın liste uçları anında tutarlı DEĞİL, yeni
    // açılmış bir issue listede gecikmeli görünüyor. Canlı testte art arda
    // iki çağrı KOPYA issue açtı (#345).
    //
    // Artık otoriter kaynak veritabanı: `githubIssueUrl` doluysa o kayıt
    // GitHub'a gitmiş demektir ve dokunulmaz.
    const bekleyenIssuelar = stepIssues.filter((i) => !i.githubIssueUrl);

    // Adımın milestone'u kurulmuş VE tüm issue'ları gönderilmişse GitHub'a
    // hiç uğramıyoruz — güncelleme akışı yalnız eksikleri tamamlar.
    if (step.githubIssueUrl && bekleyenIssuelar.length === 0) continue;

    // Milestone da aynı mantıkla: kayıtlı URL varsa numarayı ondan okuyup
    // yeniden oluşturmuyoruz. `milestoneHazirla` de başlık taramasına
    // dayanıyor ve aynı kopya riskini taşıyor.
    let milestoneNumarasi = milestoneNumarasiCikar(step.githubIssueUrl);

    if (milestoneNumarasi === null) {
      const milestone = await milestoneHazirla(config, {
        repoName,
        title: step.title,
        description: step.description,
      });
      if (!milestone.ok) throw new Error(hataMesaji(milestone.neden));
      if (milestone.olusturuldu) createdMilestonesCount++;
      milestoneNumarasi = milestone.veri.number;

      await prisma.roadmapStep.update({
        where: { id: step.id },
        data: { githubIssueUrl: `${githubRepoUrl}/milestone/${milestoneNumarasi}` },
      });
    }

    for (const issue of bekleyenIssuelar) {
      const olusan = await issueHazirla(config, {
        repoName,
        title: issue.title,
        body: issue.bodyMarkdown,
        milestoneNumber: milestoneNumarasi,
      });
      if (!olusan.ok) throw new Error(hataMesaji(olusan.neden));
      if (olusan.olusturuldu) createdIssuesCount++;

      // URL HEMEN yazılıyor: araya bir hata girerse bir sonraki çalıştırma
      // bu issue'yu "gönderilmemiş" sayıp ikinci kez açardı.
      await prisma.stepIssue.update({
        where: { id: issue.id },
        data: { githubIssueUrl: olusan.veri.htmlUrl },
      });
    }
  }

  return { githubRepoUrl, createdMilestonesCount, createdIssuesCount };
}

function mesajUret(p: {
  createdMilestonesCount: number;
  createdIssuesCount: number;
  simulated: boolean;
  guncelleme: boolean;
}): string {
  if (p.simulated) {
    // #178-1: "oluşturuldu" değil "önizlendi" — GitHub'da fiziksel bir şey yok.
    return `Önizleme: ${p.createdMilestonesCount} faz ve ${p.createdIssuesCount} detaylı issue hazırlandı. (Not: Bu bir simülasyondur; GitHub'da gerçek repo/issue oluşturulmaz.)`;
  }

  if (p.guncelleme) {
    return p.createdMilestonesCount === 0 && p.createdIssuesCount === 0
      ? "Çalışma alanı zaten güncel — yeni faz veya issue eklenmedi."
      : `Çalışma alanı güncellendi: ${p.createdMilestonesCount} yeni faz, ${p.createdIssuesCount} yeni issue eklendi.`;
  }

  return `GitHub çalışma alanı oluşturuldu: ${p.createdMilestonesCount} faz ve ${p.createdIssuesCount} issue.`;
}

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
    where: { id: assignmentId, githubStatus: { not: "PROVISIONING" } },
    data: { githubStatus: "PROVISIONING" },
  });

  if (kilit.count === 0) {
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
