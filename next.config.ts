import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // #10: Docker imajı için kendi kendine yeten çıktı.
  //
  // Öncesi runner aşaması `.next`'in tamamını kopyalayıp ÜSTÜNE ikinci kez
  // `npm install --omit=dev` çalıştırıyordu — yani bağımlılıklar iki kez
  // kuruluyor, imaja uygulamanın hiç import etmediği paketler de giriyordu.
  // standalone, Next'in izini sürdüğü YALNIZCA gerçekten kullanılan dosyaları
  // toplar; runner'da npm kurulumuna hiç gerek kalmaz.
  output: "standalone",

  serverExternalPackages: [
    // #335: @google-cloud/vertexai kaldirilma tarihini gectigi icin
    // @google/genai'ye tasindi.
    "@google/genai",
    "google-auth-library",
    // #316: nodemailer `net`/`tls`/`os`/`stream` gibi Node çekirdek modüllerini
    // kullanıyor. `instrumentation.ts` üzerinden bildirim zincirine girdiği için
    // Next onu Node dışı derlemelere de sokmaya çalışıyor ve bu, DEV modunda
    // istemci paketini komple kırıyor (layout.css / main-app.js 404, MIME
    // text/plain). Buraya eklemek paketlemeyi tamamen devre dışı bırakıp
    // çalışma anında native require kullandırıyor.
    //
    // NOT: `npm run build` bu sorunu YAKALAMIYOR — üretim derlemesi geçiyor,
    // kırılan yalnız dev. Bu yüzden sayfa yüklemeden "çalışıyor" demeyin.
    "nodemailer",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(isDev),
      },
    ];
  },
};

export default nextConfig;
