import "server-only";
import { getOctokit, hataNedeni, type GitHubConfig } from "./client";
import { yenidenDene } from "./retry";
import { logger } from "@/lib/logger";

/**
 * PR diff'ini AI incelemesine hazır hale getirir (#327).
 *
 * NEDEN AYRI BİR KATMAN: Maliyet burada belirleniyor. Gemini'ye ne kadar metin
 * gittiği tek tek bu dosyadaki sınırlara bağlı; prompt tarafına karışmış olsa
 * "faturayı ne belirliyor" sorusunun tek bir cevabı olmazdı.
 *
 * `pulls.listFiles` kullanılıyor, ham `.diff` medya tipi DEĞİL: ham diff tek
 * parça metin olarak geliyor ve dosya başına eleme yapılamıyor. Burada
 * lockfile'ı atıp kaynak dosyayı tutabilmek gerekiyor.
 */

/** Bir PR'da bakılacak azami dosya sayısı. */
export const MAKS_DOSYA = 30;

/**
 * Prompt'a girecek toplam yama uzunluğu (karakter).
 *
 * ~40k karakter kabaca 12–15k token. Gemini 2.5 Flash'ın penceresi çok daha
 * geniş; sınır pencereden değil MALİYETTEN geliyor.
 */
export const TOPLAM_DIFF_SINIRI = 40_000;

/** Tek bir dosyanın kaplayabileceği azami pay — bir dev dosya bütçeyi yemesin. */
export const DOSYA_DIFF_SINIRI = 8_000;

/**
 * İncelenmeyecek yollar.
 *
 * Üretilmiş dosyalar (lockfile, build çıktısı, snapshot) inceleme açısından
 * değersiz ama diff'in en büyük kısmı genelde onlar. Bir `package-lock.json`
 * değişikliği tek başına bütçenin tamamını yiyebilir.
 */
const ELENEN_DESENLER = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)(yarn|pnpm-)lock\.(json|yaml)$/,
  /(^|\/)(node_modules|dist|build|coverage|\.next|out)\//,
  /(^|\/)__snapshots__\//,
  /\.min\.(js|css)$/,
  /\.(png|jpe?g|gif|svg|ico|webp|avif|pdf|zip|gz|tar|woff2?|ttf|eot|mp4|mp3|wasm)$/i,
];

export type IncelenecekDosya = {
  yol: string;
  durum: string;
  yama: string;
};

export type DiffSonucu =
  | { ok: true; dosyalar: IncelenecekDosya[]; elenenSayisi: number; kirpildi: boolean }
  | { ok: false; neden: "cok-buyuk" | "incelenecek-degisiklik-yok" | ReturnType<typeof hataNedeni> };

export function elenirMi(yol: string): boolean {
  return ELENEN_DESENLER.some((d) => d.test(yol));
}

/**
 * PR'ın incelenecek dosyalarını getirir.
 *
 * Sınır aşımında BOŞ dönmüyoruz, KIRPIYORUZ: 50 dosyalık bir PR'ı tamamen
 * incelememektense ilk 30 dosyasını incelemek öğrenciye daha faydalı. Kırpma
 * `kirpildi` ile bildiriliyor ki yorumda dürüstçe söylenebilsin.
 *
 * Tek istisna: elemeden sonra hiç dosya kalmıyorsa (yalnız lockfile değişmiş)
 * çağrı yapılmıyor — boş bir diff için Gemini'ye para ödemenin anlamı yok.
 */
export async function prDiffiniAl(
  config: GitHubConfig,
  params: { repo: string; prNumarasi: number },
): Promise<DiffSonucu> {
  const octokit = getOctokit(config);

  let ham;
  try {
    ham = await yenidenDene(
      () =>
        octokit.pulls.listFiles({
          owner: config.owner,
          repo: params.repo,
          pull_number: params.prNumarasi,
          // MAKS_DOSYA'dan fazlasını istiyoruz ki "kaç dosya elendi" doğru
          // sayılabilsin; elemeden SONRA kırpıyoruz.
          per_page: 100,
        }),
      { ad: "pulls.listFiles" },
    );
  } catch (error) {
    const neden = hataNedeni(error);
    logger.error("PR dosyaları okunamadı", { repo: params.repo, pr: params.prNumarasi, neden });
    return { ok: false, neden };
  }

  const tumu = ham.data;
  const aday = tumu.filter((d) => !elenirMi(d.filename) && typeof d.patch === "string");
  const elenenSayisi = tumu.length - aday.length;

  if (aday.length === 0) {
    return { ok: false, neden: "incelenecek-degisiklik-yok" };
  }

  const dosyalar: IncelenecekDosya[] = [];
  let toplam = 0;
  let kirpildi = aday.length > MAKS_DOSYA || elenenSayisi > 0;

  for (const d of aday.slice(0, MAKS_DOSYA)) {
    const yama = (d.patch as string).slice(0, DOSYA_DIFF_SINIRI);
    if ((d.patch as string).length > DOSYA_DIFF_SINIRI) kirpildi = true;

    // Bütçe dolduysa dur — kalanları eklemek sınırı aşardı.
    if (toplam + yama.length > TOPLAM_DIFF_SINIRI) {
      kirpildi = true;
      break;
    }

    dosyalar.push({ yol: d.filename, durum: d.status, yama });
    toplam += yama.length;
  }

  // İlk dosya tek başına bütçeyi aşıyorsa döngü hiç eklemeden çıkar.
  if (dosyalar.length === 0) return { ok: false, neden: "cok-buyuk" };

  return { ok: true, dosyalar, elenenSayisi, kirpildi };
}
