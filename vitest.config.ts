import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // #321: `server-only` Next.js tarafindan saglaniyor, vitest altinda
      // cozulemiyor. Bos bir module yonlendiriyoruz ki sunucu modullerini
      // import eden testler yuklenebilsin.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  // tsconfig "jsx: preserve" (Next.js) kullanır; vitest'in esbuild'i JSX'i
  // otomatik runtime ile dönüştürmeli, yoksa "React is not defined" (#123).
  esbuild: { jsx: "automatic" },
  test: {
    // Varsayılan ortam node (route + lib testleri). Component testleri dosya
    // başına `// @vitest-environment jsdom` docblock'u ile jsdom kullanır (#123).
    environment: "node",
    // #325: act(...) uyarilarini hataya cevirir; sessizce birikmelerini onler.
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.{test,spec}.{ts,tsx}"],
  },
});
