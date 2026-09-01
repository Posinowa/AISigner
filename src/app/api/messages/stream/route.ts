import { requireAuth } from "@/lib/auth/guard";
import { aboneOl, type CanliOlay } from "@/features/messaging/server/canli-akis";

/**
 * Canlı akış (SSE) — #329.
 *
 * ⚠️ `force-dynamic` ve Node.js çalışma zamanı ZORUNLU: bu uç kalıcı bir
 * bağlantı açıyor, önbelleğe alınamaz ve Edge'de tutulamaz.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Bağlantıyı canlı tutan yorum satırı aralığı.
 *
 * Vekiller (nginx, platform yük dengeleyicileri) sessiz bağlantıyı genelde
 * 60 sn civarında keser. Düzenli bir yorum, kesilmeyi önler; SSE'de `:` ile
 * başlayan satır istemci tarafında olay üretmeden yok sayılır.
 */
const CANLI_TUTMA_MS = 25_000;

export async function GET() {
  const auth = await requireAuth(["MENTOR", "STUDENT", "ADMIN"]);
  if (!auth.authorized) return auth.response;

  const userId = auth.session.user.id!;
  const encoder = new TextEncoder();

  let temizle: (() => void) | null = null;
  let kalpAtisi: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let kapali = false;

      const yaz = (metin: string) => {
        if (kapali) return;
        try {
          controller.enqueue(encoder.encode(metin));
        } catch {
          // İstemci gitmiş olabilir; kapatma yolu aşağıda zaten çalışacak.
          kapali = true;
        }
      };

      // İlk olay hemen gitmeli: istemci "bağlandım" diyebilsin ve yoklama
      // yedeğini kapatabilsin.
      yaz(": bagli\n\n");

      const abonelikBirak = aboneOl({
        userId,
        gorulen: new Set<string>(),
        gonder: (olay: CanliOlay) => {
          yaz(`event: ${olay.tip}\ndata: ${JSON.stringify(olay)}\n\n`);
        },
      });

      kalpAtisi = setInterval(() => yaz(": kalp\n\n"), CANLI_TUTMA_MS);

      temizle = () => {
        kapali = true;
        abonelikBirak();
        if (kalpAtisi) clearInterval(kalpAtisi);
        kalpAtisi = null;
      };
    },

    // Sekme kapandığında / gezinildiğinde buraya düşer. Aboneliği bırakmazsak
    // pod, kimsenin dinlemediği kullanıcılar için sorgu atmayı sürdürür.
    cancel() {
      temizle?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx'in yanıtı tamponlamasını engeller; tamponlanırsa olaylar
      // istemciye ancak bağlantı kapanınca ulaşır — yani hiç.
      "X-Accel-Buffering": "no",
    },
  });
}
