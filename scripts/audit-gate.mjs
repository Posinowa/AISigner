/**
 * Üretim bağımlılık denetimi kapısı (#469'un devamı).
 *
 * `npm audit --omit=dev --audit-level=high` ile AYNI eşik, tek farkla: aşağıdaki
 * listede adı geçen danışma kayıtları (GHSA) bloke etmez.
 *
 * ⚠️ NEDEN GEREKTİ: picomatch GHSA-fc5q-39xc-vjpf (ReDoS) `<= 4.0.7`'nin TAMAMINI
 * etkiliyor ve DÜZELTİLMİŞ SÜRÜM YOK. Paket bize `@sentry/nextjs` →
 * `@rollup/plugin-commonjs` üzerinden geliyor; yalnız derleme anında, bizim
 * yapılandırmamızdaki glob desenleriyle çalışıyor. Düz `npm audit` her PR'ı
 * kırıyordu ve yapılabilecek hiçbir şey yoktu — #469'un uyardığı "audit'i yok
 * say" alışkanlığının tam başlangıcı.
 *
 * ⚠️ İSTİSNA DAR VE SÜRELİ:
 *   - Eşleşme GHSA kimliği + paket adıyla. Aynı paketteki BAŞKA bir açık,
 *     ya da aynı GHSA'nın başka pakette çıkması yine bloke eder.
 *   - `sonTarih` geçince istisna kendiliğinden düşer ve CI kırmızıya döner —
 *     upstream düzeltmesi çıkmış mı diye yeniden bakmaya zorlar.
 *   - Zincirdeki ara paketler (`@rollup/pluginutils`, `fdir`, `@sentry/nextjs`)
 *     kendi açıkları değil, picomatch'in yansıması. Kapı ara paketlere değil
 *     yaprak danışma kayıtlarına bakar; ara pakette GERÇEK yeni bir açık
 *     çıkarsa o ayrı kayıt olarak görünür ve bloke eder.
 *
 * `npm audit fix --force` KULLANMAYIN (#545) — Sentry'yi 8.x'e düşürüyor.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {{ ghsa: string, paket: string, gerekce: string, sonTarih: string }[]} */
export const ISTISNALAR = [
  {
    ghsa: "GHSA-fc5q-39xc-vjpf",
    paket: "picomatch",
    gerekce:
      "ReDoS, düzeltilmiş sürüm yok (<=4.0.7). Yalnız derleme anında, @sentry/nextjs → @rollup/plugin-commonjs zincirinde.",
    sonTarih: "2027-01-31",
  },
];

const BLOKE_EDEN = new Set(["high", "critical"]);

/**
 * `npm audit --json` çıktısındaki yaprak danışma kayıtları (tekilleştirilmiş).
 * Ara paketlerin `via` dizisindeki string girdiler yalnız yönlendirme; gerçek
 * kayıt nesne olanlar.
 */
export function danismaKayitlari(rapor) {
  const kayitlar = new Map();
  for (const zafiyet of Object.values(rapor.vulnerabilities ?? {})) {
    for (const via of zafiyet.via ?? []) {
      if (typeof via !== "object" || via === null) continue;
      const anahtar = `${via.name}:${via.source ?? via.url}`;
      if (!kayitlar.has(anahtar)) {
        kayitlar.set(anahtar, {
          paket: via.name,
          ghsa: (via.url ?? "").split("/").pop() ?? "",
          baslik: via.title ?? "",
          seviye: via.severity,
          url: via.url ?? "",
        });
      }
    }
  }
  return [...kayitlar.values()];
}

/** Kaydı örten, süresi DOLMAMIŞ istisna; yoksa null. */
export function ortenIstisna(kayit, bugun, istisnalar = ISTISNALAR) {
  return (
    istisnalar.find(
      (i) => i.ghsa === kayit.ghsa && i.paket === kayit.paket && bugun <= i.sonTarih,
    ) ?? null
  );
}

/**
 * @param {string} bugun YYYY-MM-DD (UTC) — test edilebilsin diye dışarıdan.
 */
export function degerlendir(rapor, bugun, istisnalar = ISTISNALAR) {
  const yuksek = danismaKayitlari(rapor).filter((k) => BLOKE_EDEN.has(k.seviye));
  const engelleyen = yuksek.filter((k) => !ortenIstisna(k, bugun, istisnalar));
  const muaf = yuksek.filter((k) => ortenIstisna(k, bugun, istisnalar));
  const suresiDolan = istisnalar.filter((i) => bugun > i.sonTarih);
  return { engelleyen, muaf, suresiDolan };
}

function calistir() {
  // Tek string + shell: Windows'ta `npm` bir .cmd ve shell'siz başlatılamıyor.
  // Komut koddaki sabit, dışarıdan girdi almıyor.
  const sonuc = spawnSync("npm audit --omit=dev --json", {
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });

  let rapor;
  try {
    rapor = JSON.parse(sonuc.stdout);
  } catch {
    // Kapalı başarısızlık: denetim çalışmadıysa "temiz" sayılmaz.
    console.error("❌ npm audit çıktısı okunamadı.\n", sonuc.stderr || sonuc.stdout);
    process.exit(1);
  }
  if (rapor.error) {
    console.error("❌ npm audit hata verdi:", rapor.error.summary ?? rapor.error);
    process.exit(1);
  }

  const bugun = new Date().toISOString().slice(0, 10);
  const { engelleyen, muaf, suresiDolan } = degerlendir(rapor, bugun);

  for (const i of suresiDolan) {
    console.warn(
      `⚠️  ${i.ghsa} (${i.paket}) istisnasının süresi ${i.sonTarih} tarihinde doldu — artık bloke ediyor. ` +
        "Upstream düzeltmesine bakın; hâlâ yoksa gerekçeyle birlikte süreyi uzatın.",
    );
  }
  for (const k of muaf) {
    console.log(`ℹ️  Muaf: ${k.paket} ${k.ghsa} [${k.seviye}] — ${k.baslik}`);
  }
  if (engelleyen.length > 0) {
    console.error(`\n❌ ${engelleyen.length} high/critical üretim açığı:`);
    for (const k of engelleyen) {
      console.error(`   - ${k.paket} ${k.ghsa} [${k.seviye}] ${k.baslik}\n     ${k.url}`);
    }
    process.exit(1);
  }
  console.log("✅ Üretim bağımlılıklarında bloke eden high/critical açık yok.");
}

const anaModulMu =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (anaModulMu) calistir();
