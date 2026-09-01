import "server-only";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";
import { createRateLimiter } from "@/lib/rate-limit";
import { guncelRizaVar } from "@/features/kvkk/riza";
import { getOctokit, hataNedeni, readGitHubConfig, type GitHubConfig } from "./client";
import { yenidenDene } from "./retry";
import { prDiffiniAl } from "./pr-diff";
import { kodIncelemesiUret, type Inceleme, type Onem } from "@/features/ai/server/code-review";
import type { IsleSonucu } from "./webhook-isle";

/**
 * PR açıldığında AI ön incelemesi yazar (#327).
 *
 * BU DOSYA PARA HARCIYOR. Her erken `return` bir "harcamadan çık" kapısıdır ve
 * sıra ucuzdan pahalıya doğrudur:
 *
 *   1. yapılandırma / repo eşleşmesi   — bedava
 *   2. KVKK rızası                      — bir DB sorgusu (ve hukuken ilk sırada)
 *   3. daha önce yorum yazdık mı        — bir GitHub çağrısı
 *   4. günlük tavanlar                  — bir DB sorgusu
 *   5. diff (filtrelenmiş, kırpılmış)   — bir GitHub çağrısı
 *   6. Gemini                            — ÜCRETLİ
 *
 * Herhangi bir aşamada durmak HATA DEĞİLDİR: `islendi:false` + açıklama döner,
 * webhook GitHub'a yine 2xx verir.
 */

/** Bir öğrencinin günde alabileceği azami inceleme. */
const OGRENCI_GUNLUK_TAVAN = 10;

/** Tüm platform için günlük tavan — kaçak bir döngü faturayı patlatmasın. */
const GENEL_GUNLUK_TAVAN = 200;

const GUN = 24 * 60 * 60;

const ogrenciLimiti = createRateLimiter("ai-code-review-ogrenci", {
  maxRequests: OGRENCI_GUNLUK_TAVAN,
  windowSeconds: GUN,
});

const genelLimit = createRateLimiter("ai-code-review-genel", {
  maxRequests: GENEL_GUNLUK_TAVAN,
  windowSeconds: GUN,
});

/**
 * Yorumun başına konan görünmez işaret.
 *
 * İDEMPOTENSİN BİRİNCİ (UCUZ) KATMANI. `ProcessedWebhook` yalnızca aynı
 * TESLİMATI eler; bir PR taslakken açılıp sonra "hazır" işaretlendiğinde iki
 * FARKLI teslimat gelir ve ikisi de incelemeye uygundur. Yorumları okuyup bu
 * işareti aramak, o durumda AI'ı hiç çağırmadan çıkmayı sağlar.
 *
 * ⚠️ TEK BAŞINA YETMEZ — canlı testte kanıtlandı: GitHub'ın liste uçları anında
 * tutarlı değil, yeni yazılmış bir kayıt listede gecikmeli görünüyor. Otoriter
 * koruma `PullRequestReview` tablosunda (aşağıda).
 */
export const BOT_ISARETI = "<!-- aisigner-ai-review -->";

const ONEM_ETIKETI: Record<Onem, string> = {
  uyari: "⚠️ Dikkat",
  oneri: "💡 Öneri",
  bilgi: "ℹ️ Bilgi",
};

/** Önce uyarılar: en önemli bulgu en üstte görünsün. */
const ONEM_SIRASI: Record<Onem, number> = { uyari: 0, oneri: 1, bilgi: 2 };

/**
 * İncelemeyi PR yorumuna çevirir.
 *
 * Baştaki ibare zorunlu: yorumun bir bot tarafından yazıldığı ve MENTÖRÜN
 * değerlendirmesinin esas olduğu açıkça yazılmazsa, öğrenci otomatik bir
 * uyarıyı mentörünün görüşü sanabilir.
 */
export function incelemeYorumu(inceleme: Inceleme, kirpildi: boolean): string {
  const satirlar = [
    BOT_ISARETI,
    "### 🤖 AI ön incelemesi",
    "",
    "> Bu yorum otomatik üretildi ve **ön inceleme** niteliğindedir. Hatalı ya da",
    "> eksik olabilir; **mentörünün değerlendirmesi esastır.** Katılmadığın bir",
    "> nokta varsa mentörünle konuş.",
    "",
    inceleme.ozet,
  ];

  if (inceleme.bulgular.length === 0) {
    satirlar.push("", "Diff üzerinde öne çıkan bir bulgu yok. 👍");
  } else {
    satirlar.push("", "---", "");
    const sirali = [...inceleme.bulgular].sort(
      (a, b) => ONEM_SIRASI[a.onem] - ONEM_SIRASI[b.onem],
    );
    for (const b of sirali) {
      satirlar.push(`**${ONEM_ETIKETI[b.onem]} — \`${b.dosya}\`: ${b.baslik}**`, "", b.aciklama, "");
    }
  }

  if (kirpildi) {
    satirlar.push(
      "---",
      "",
      "_Not: Değişikliklerin tamamı incelenmedi — üretilmiş dosyalar (lockfile, build çıktısı) elendi ve diff boyut sınırına göre kırpıldı._",
    );
  }

  return satirlar.join("\n");
}

/** PR gövdesinden/başlığından/dal adından bağlı issue numarasını çıkarır. */
export function issueNumarasiCikar(metinler: (string | null | undefined)[]): number | null {
  for (const metin of metinler) {
    if (!metin) continue;
    // Önce kapatma anahtar kelimesi — en güvenilir sinyal.
    const kapatma = metin.match(/\b(?:closes|fixes|resolves|kapatır)\s+#(\d+)/i);
    if (kapatma) return Number(kapatma[1]);
    // Sonra depo kuralımızdaki dal adı: feature/issue-12-...
    const dal = metin.match(/\bissue-(\d+)\b/i);
    if (dal) return Number(dal[1]);
    // Son çare: metindeki ilk #N.
    const duz = metin.match(/(?:^|\s)#(\d+)\b/);
    if (duz) return Number(duz[1]);
  }
  return null;
}

type PrOlayi = {
  repoUrl: string;
  repoAdi: string;
  sahip: string;
  numara: number;
  baslik: string;
  govde: string | null;
  dal: string | null;
  taslak: boolean;
};

function prOlayiniCoz(govde: unknown): PrOlayi | null {
  const g = govde as {
    repository?: { html_url?: string; name?: string; owner?: { login?: string } };
    pull_request?: {
      number?: number;
      title?: string;
      body?: string | null;
      draft?: boolean;
      head?: { ref?: string };
    };
  };

  const repoUrl = g?.repository?.html_url;
  const repoAdi = g?.repository?.name;
  const sahip = g?.repository?.owner?.login;
  const numara = g?.pull_request?.number;

  if (!repoUrl || !repoAdi || !sahip || typeof numara !== "number") return null;

  return {
    repoUrl,
    repoAdi,
    sahip,
    numara,
    baslik: g.pull_request?.title ?? "",
    govde: g.pull_request?.body ?? null,
    dal: g.pull_request?.head?.ref ?? null,
    taslak: Boolean(g.pull_request?.draft),
  };
}

/** Bu PR'a daha önce inceleme yazdık mı? */
async function zatenIncelendiMi(config: GitHubConfig, pr: PrOlayi): Promise<boolean> {
  const octokit = getOctokit(config);
  const yorumlar = await yenidenDene(
    () =>
      octokit.issues.listComments({
        owner: config.owner,
        repo: pr.repoAdi,
        issue_number: pr.numara,
        per_page: 100,
      }),
    { ad: "issues.listComments" },
  );
  return yorumlar.data.some((y) => (y.body ?? "").includes(BOT_ISARETI));
}

/**
 * Bir PR açılma olayını işler.
 *
 * Hiçbir durumda fırlatmaz: webhook GitHub'a 2xx dönmek zorunda.
 */
export async function prAcildiginiIncele(govdeHam: unknown): Promise<IsleSonucu> {
  const pr = prOlayiniCoz(govdeHam);
  if (!pr) return { islendi: false, aciklama: "olayda PR bilgisi yok" };

  // Taslak PR henüz incelenmeye hazır değil; "ready_for_review" geldiğinde
  // yeniden değerlendirilir.
  if (pr.taslak) return { islendi: false, aciklama: "taslak PR" };

  const config = readGitHubConfig();
  if (!config) return { islendi: false, aciklama: "GitHub yapılandırılmamış" };

  // Token başka bir hesaba da yazma yetkisi taşıyor olabilir; yanlış yere yorum
  // bırakmayalım.
  if (pr.sahip.toLowerCase() !== config.owner.toLowerCase()) {
    return { islendi: false, aciklama: "repo bizim hesabımızda değil" };
  }

  const atama = await prisma.assignedProject.findFirst({
    where: { githubRepoUrl: pr.repoUrl },
    select: {
      id: true,
      studentProfile: {
        select: {
          id: true,
          experienceLevel: true,
          user: { select: { id: true } },
        },
      },
      projectTemplate: { select: { title: true } },
      roadmap: { select: { id: true } },
    },
  });

  // Bizim açmadığımız bir repodan gelen olay. Hata değil.
  if (!atama) return { islendi: false, aciklama: "eşleşen proje ataması yok" };

  // KVKK: kod yurt dışına gidecek. Rıza yoksa BURADA duruyoruz — Gemini'ye
  // giden yolda başka kapı yok. Yürürlükteki metne rıza aranıyor, çünkü kod
  // aktarımı rızanın kapsamına #327 ile eklendi (bkz. `guncelRizaVar`).
  if (!(await guncelRizaVar(atama.studentProfile.user.id))) {
    incrementCounter("ai.code-review.riza-yok");
    logger.info("PR incelemesi atlandı: güncel AI rızası yok", {
      assignedProjectId: atama.id,
    });
    return { islendi: false, aciklama: "öğrencinin güncel AI rızası yok" };
  }

  try {
    if (await zatenIncelendiMi(config, pr)) {
      return { islendi: false, aciklama: "bu PR zaten incelenmiş" };
    }
  } catch (error) {
    // Yorumları okuyamadıysak kopya yorum riskini almıyoruz.
    logger.warn("PR yorumları okunamadı, inceleme atlandı", { neden: hataNedeni(error) });
    return { islendi: false, aciklama: "mevcut yorumlar okunamadı" };
  }

  const ogrenci = await ogrenciLimiti.check(atama.studentProfile.id);
  if (!ogrenci.allowed) {
    incrementCounter("ai.code-review.tavan.ogrenci");
    logger.warn("PR incelemesi atlandı: öğrenci günlük tavanı doldu", {
      studentProfileId: atama.studentProfile.id,
    });
    return { islendi: false, aciklama: "öğrenci günlük inceleme tavanı doldu" };
  }

  const genel = await genelLimit.check("global");
  if (!genel.allowed) {
    incrementCounter("ai.code-review.tavan.genel");
    logger.error("PR incelemesi atlandı: PLATFORM günlük tavanı doldu");
    return { islendi: false, aciklama: "platform günlük inceleme tavanı doldu" };
  }

  const diff = await prDiffiniAl(config, { repo: pr.repoAdi, prNumarasi: pr.numara });
  if (!diff.ok) {
    incrementCounter(`ai.code-review.diff-yok.${diff.neden}`);
    return { islendi: false, aciklama: `diff alınamadı: ${diff.neden}` };
  }

  // Adım bağlamı: bulunamazsa inceleme YİNE yapılır, sadece daha genel olur.
  const issueNo = issueNumarasiCikar([pr.govde, pr.baslik, pr.dal]);
  const adim = issueNo
    ? await prisma.stepIssue.findFirst({
        where: {
          githubIssueUrl: `${pr.repoUrl}/issues/${issueNo}`,
          ...(atama.roadmap ? { step: { roadmapId: atama.roadmap.id } } : {}),
        },
        select: { step: { select: { title: true, description: true } } },
      })
    : null;

  let inceleme: Inceleme;
  try {
    inceleme = await kodIncelemesiUret(diff.dosyalar, {
      projeBasligi: atama.projectTemplate.title,
      adimBasligi: adim?.step.title ?? null,
      adimAciklamasi: adim?.step.description ?? null,
      deneyimSeviyesi: atama.studentProfile.experienceLevel,
      prBasligi: pr.baslik,
      kirpildi: diff.kirpildi,
    });
  } catch (error) {
    // MOCK'A DÜŞMÜYORUZ: uydurma bir inceleme public bir PR'a yazılamaz.
    logger.error("AI kod incelemesi üretilemedi, yorum yazılmadı", {
      pr: pr.numara,
      error: error instanceof Error ? error.message : String(error),
    });
    return { islendi: false, aciklama: "AI incelemesi üretilemedi" };
  }

  // İDEMPOTENSİN İKİNCİ (OTORİTER) KATMANI — yorumdan HEMEN ÖNCE.
  //
  // Yukarıdaki yorum taraması GitHub'ın gecikmeli listesine güvenir; bu kayıt
  // güvenmez. Benzersizlik ihlali "başka bir teslimat bu PR'ı zaten aldı"
  // demektir ve İKİNCİ YORUM YAZILMAZ. Yazmadan ÖNCE ekleniyor: sonra
  // eklenseydi iki eşzamanlı teslimat ikisi de kontrolü geçip iki yorum
  // bırakırdı (#326'daki `ProcessedWebhook` ile aynı gerekçe).
  //
  // AI çağrısından SONRA duruyor — bilinçli: yazma başarısız olursa bir
  // sonraki teslimat yeniden deneyebilsin diye kaydı siliyoruz. Nadir bir
  // yarışta iki AI çağrısı yapılabilir (maliyet), ama public PR'a asla iki
  // yorum düşmez. Ödünç doğru yönde: para geri alınabilir, yorum alınamaz.
  try {
    await prisma.pullRequestReview.create({
      data: { repoUrl: pr.repoUrl, prNumber: pr.numara },
    });
  } catch {
    logger.info("PR incelemesi atlandı: başka bir teslimat zaten yazmış", {
      pr: pr.numara,
    });
    return { islendi: false, aciklama: "bu PR zaten incelenmiş" };
  }

  try {
    await yenidenDene(
      () =>
        getOctokit(config).issues.createComment({
          owner: config.owner,
          repo: pr.repoAdi,
          issue_number: pr.numara,
          body: incelemeYorumu(inceleme, diff.kirpildi),
        }),
      { ad: "issues.createComment" },
    );
  } catch (error) {
    incrementCounter("ai.code-review.yorum-yazilamadi");
    // Kaydı geri al: yorum yazılamadıysa bu PR "incelenmiş" sayılmamalı,
    // yoksa geçici bir GitHub hatası incelemeyi KALICI olarak engellerdi.
    await prisma.pullRequestReview
      .deleteMany({ where: { repoUrl: pr.repoUrl, prNumber: pr.numara } })
      .catch(() => {});
    logger.error("AI incelemesi PR'a yazılamadı", {
      pr: pr.numara,
      neden: hataNedeni(error),
    });
    return { islendi: false, aciklama: "yorum yazılamadı" };
  }

  incrementCounter("ai.code-review.yazildi");
  logger.info("AI kod incelemesi yazıldı", {
    pr: pr.numara,
    repo: pr.repoAdi,
    bulgu: inceleme.bulgular.length,
  });
  return { islendi: true, aciklama: `inceleme yazıldı (${inceleme.bulgular.length} bulgu)` };
}
