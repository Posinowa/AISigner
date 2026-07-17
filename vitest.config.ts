import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  // tsconfig "jsx: preserve" (Next.js) kullanır; vitest'in esbuild'i JSX'i
  // otomatik runtime ile dönüştürmeli, yoksa "React is not defined" (#123).
  esbuild: { jsx: "automatic" },
  test: {
    // Varsayılan ortam node (route + lib testleri). Component testleri dosya
    // başına `// @vitest-environment jsdom` docblock'u ile jsdom kullanır (#123).
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
