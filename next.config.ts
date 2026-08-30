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
    "@google-cloud/vertexai",
    "google-auth-library",
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
