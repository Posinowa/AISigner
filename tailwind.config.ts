import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}"
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