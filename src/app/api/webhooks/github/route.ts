import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import {
  webhookImzasiniDogrula,
  webhookSirriVarMi,
} from "@/features/github/server/webhook-imza";
import { issueKapandiginiIsle } from "@/features/github/server/webhook-isle";

/**
 * GitHub webhook alıcısı (#326).
 *
 * ⚠️ KİMLİK DOĞRULAMASIZ VE PUBLIC — middleware'in `publicPaths`'inde. Tek
 * koruma HMAC imzası. Aşağıdaki SIRA önemlidir, değiştirmeyin:
 *
 *   1. rate-limit    — imza doğrulama HMAC hesabı; imzasız sel bunu tüketmesin
 *   2. HAM gövdeyi oku — `req.json()` DEĞİL: parse+serialize baytları değiştirir
 *                        ve imza tutmaz
 *   3. imza doğrula   — geçmeden HİÇBİR iş yapılmaz
 *   4. replay kontrolü — aynı teslimat iki kez işlenmesin
 *   5. olayı işle
 *
 * GITHUB'A HER ZAMAN 2xx DÖNMEYE ÇALIŞIRIZ (imza/rate-limit hariç): GitHub
 * ardışık hata alan bir webhook'u kendiliğinden DEVRE DIŞI bırakır. Bilinmeyen
 * olay tipleri de sessizce 200 döner.
 */

const limiter = createRateLimiter("github-webhook", {
  maxRequests: 60,
  windowSeconds: 60,
});

/** İşlediğimiz olaylar. Diğerleri sessizce yok sayılır. */
const ILGILENILEN_OLAYLAR = new Set(["issues", "pull_request"]);

export async function POST(req: Request) {
  const h = await headers();

  // 1) Rate-limit — imzasız istek seli HMAC hesabı yaptırmasın.
  const rl = await limiter.check(getClientIp(h));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  // Yapılandırma eksikse bunu SESSİZ bir başarı gibi göstermiyoruz: aksi halde
  // webhook kurulmuş ama hiçbir şey yapmıyor olurdu ve kimse fark etmezdi.
  if (!webhookSirriVarMi()) {
    logger.error("GitHub webhook geldi ama GITHUB_WEBHOOK_SECRET tanımlı değil");
    return NextResponse.json(
      { error: "Webhook yapılandırılmamış." },
      { status: 503 },
    );
  }

  // 2) HAM gövde — imza bunun üzerinden hesaplanıyor.
  const hamGovde = await req.text();

  // 3) İmza.
  const imza = webhookImzasiniDogrula(hamGovde, h.get("x-hub-signature-256"));
  if (!imza.gecerli) {
    logger.warn("GitHub webhook imzası reddedildi", { neden: imza.neden });
    // 401: kimliği doğrulanamadı. Nedeni gövdede AÇIKLAMIYORUZ — saldırgana
    // hangi aşamada takıldığını söylemek gereksiz bilgi verir.
    return NextResponse.json({ error: "Geçersiz imza." }, { status: 401 });
  }

  const teslimatId = h.get("x-github-delivery");
  const olay = h.get("x-github-event") ?? "bilinmiyor";

  if (!teslimatId) {
    // İmza geçerli ama teslimat kimliği yok — GitHub her zaman gönderir.
    logger.warn("GitHub webhook'ta X-GitHub-Delivery yok", { olay });
    return NextResponse.json({ error: "Teslimat kimliği yok." }, { status: 400 });
  }

  // 4) Replay/idempotens: aynı teslimat ikinci kez işlenmesin.
  //
  // Kayıt İŞLEMEDEN ÖNCE atılıyor ve benzersizlik ihlali "zaten işlendi"
  // demek. Sonra atsaydık, iki eşzamanlı teslimat ikisi de kontrolü geçip
  // olayı iki kez işlerdi.
  try {
    await prisma.processedWebhook.create({ data: { deliveryId: teslimatId, event: olay } });
  } catch {
    logger.info("GitHub webhook tekrar teslimatı yok sayıldı", { teslimatId, olay });
    return NextResponse.json({ ok: true, tekrar: true });
  }

  if (!ILGILENILEN_OLAYLAR.has(olay)) {
    return NextResponse.json({ ok: true, islendi: false, aciklama: "ilgilenilmeyen olay" });
  }

  try {
    const govde = JSON.parse(hamGovde) as { action?: string };

    // issue "closed", PR "closed" + merged.
    const kapandi =
      govde.action === "closed" &&
      (olay === "issues" ||
        (olay === "pull_request" &&
          Boolean((govde as { pull_request?: { merged?: boolean } }).pull_request?.merged)));

    if (!kapandi) {
      return NextResponse.json({ ok: true, islendi: false, aciklama: "kapanma olayı değil" });
    }

    const sonuc = await issueKapandiginiIsle(govde);
    return NextResponse.json({ ok: true, ...sonuc });
  } catch (error) {
    // GitHub'a 500 dönmek webhook'un devre dışı bırakılmasına yol açar.
    // Hatayı loglayıp 200 dönüyoruz; #316 ile operatöre bildirim de gidiyor.
    logger.error("GitHub webhook işlenemedi", {
      teslimatId,
      olay,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: true, islendi: false, aciklama: "işleme hatası" });
  }
}
