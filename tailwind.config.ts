import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          0: "#070713",
          50: "#0c0c1a",
          100: "#10101f",
          200: "#1a1a30",
          300: "#252544",
          400: "#3a3a60",
        },
        aurora: {
          magenta: "#ff3da3",
          rose: "#ff7ab8",
          violet: "#8b5cf6",
          indigo: "#6366f1",
          azure: "#38bdf8",
          teal: "#2dd4bf",
          mint: "#a3e635",
          amber: "#fbbf24",
          peach: "#fb923c",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
};

export default config;
