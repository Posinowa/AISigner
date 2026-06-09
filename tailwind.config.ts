import type { Config } from "tailwindcss";

/*
 * Tailwind v4 kullanılıyor. Tasarım tokenları (renkler, radius vb.) artık
 * `src/app/globals.css` içindeki @theme bloğunda tanımlı.
 *
 * Bu dosya build sırasında YÜKLENMEZ — v4, `@import "tailwindcss"` ile içerik
 * taramasını otomatik yapar. Dosya yalnızca shadcn/ui CLI'ı için tutuluyor
 * (components.json -> "config"). Buraya renk/tema eklemeyin; globals.css @theme
 * kullanın.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
};

export default config;
