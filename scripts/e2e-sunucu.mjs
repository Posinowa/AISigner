/**
 * #518 — E2E'nin çalıştırdığı sunucu, ÜRETİMİN çalıştırdığı sunucu olsun.
 *
 * ⚠️ NEDEN VAR: `next.config.ts` `output: "standalone"` ve
 * `docker-entrypoint.sh` üretimde `exec node server.js` çalıştırıyor. E2E ise
 * `next start` kullanıyordu — Next bunu her koşuda uyarı olarak da yazıyordu
 * ("does not work with output: standalone"). Yani #505'in bütün gerekçesi
 * "modüllerin ARASINDA yaşayan hatalar" iken, sunucunun KENDİSİ test
 * edilenle dağıtılan arasında farklıydı.
 *
 * Fark ölçüldü: oturumsuz `/student-dashboard` isteğinde `next start` göreli
 * `Location` üretiyor, standalone ise `HOSTNAME`/`PORT`'tan kurulmuş MUTLAK
 * bir URL (`server.js` içine `trustHostHeader: false` gömülü, host `Host`
 * başlığından okunmuyor).
 *
 * Bu betik Dockerfile'ın runner katmanıyla AYNI işi yapıyor: standalone
 * çıktısı `public/` ve `.next/static`'i İÇERMEZ, elle kopyalanmaları gerekir.
 */
import { cp, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const kok = process.cwd();
const standalone = path.join(kok, ".next", "standalone");

try {
  await access(path.join(standalone, "server.js"));
} catch {
  console.error(
    "❌ .next/standalone/server.js yok — önce `npm run build` çalıştırın.\n" +
      "   (E2E üretim derlemesi üzerinde koşar, `next dev` değil.)",
  );
  process.exit(1);
}

// Dockerfile ile aynı iki kopya. `recursive` + üzerine yazma: derleme
// tekrarlandığında eski varlıklar taze olanlarla değişsin.
await cp(path.join(kok, "public"), path.join(standalone, "public"), { recursive: true });
await cp(
  path.join(kok, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);

/*
 * ⚠️ `HOSTNAME` ORTAMDAN SİLİNİYOR — verilmediğinde `server.js` varsayılanı
 * `0.0.0.0` ve Dockerfile da tam olarak onu veriyor (`ENV HOSTNAME=0.0.0.0`).
 *
 * Silmek ŞART, "temizlik" değil: `HOSTNAME` işletim sistemi tarafından
 * makinenin adına ayarlanmış oluyor (bu depoda geliştirme makinesinde ve
 * GitHub Actions koşucusunda da dolu). Devralınsaydı sunucu var olmayan bir
 * arayüze bağlanmaya çalışırdı.
 *
 * Yerine `127.0.0.1` yazmak cazip görünüyor (config'in geri kalanı bilerek
 * `localhost` yerine 127.0.0.1 kullanıyor) ama ÖLÇÜLDÜ: o değerde standalone
 * sunucu yönlendirmeleri `http://localhost:<port>/...` mutlak URL'i olarak
 * üretiyor, tarayıcı origin değiştirdiği için oturum çerezi düşüyor ve beş
 * test "ürün hatası" gibi kırmızı oluyor. Sunucu yine 127.0.0.1'den
 * erişilebilir; `0.0.0.0` tüm arayüzleri dinliyor.
 */
const env = { ...process.env, PORT: process.env.E2E_PORT ?? "3100" };
delete env.HOSTNAME;

const cocuk = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  env,
  stdio: "inherit",
});

// Playwright sunucuyu SIGTERM ile kapatıyor; sinyali ilet ki süreç sızmasın.
for (const sinyal of ["SIGTERM", "SIGINT"]) {
  process.on(sinyal, () => cocuk.kill(sinyal));
}
cocuk.on("exit", (kod) => process.exit(kod ?? 0));
