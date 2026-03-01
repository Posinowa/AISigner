import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
        colors: {
            background: 'var(--background)',
            foreground: 'var(--foreground)',
        },
        fontFamily: {
            sans: ['var(--font-sans)', 'sans-serif'],
            mono: ['var(--font-mono)', 'monospace'],
        },
    },
  },
  plugins: [],
};

export default config;