import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: ["focus-visible:outline-none", "focus-visible:ring-2"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#5227ff",
          "purple-bright": "#6c4fff",
          lime: "#d1ff55",
          red: "#e95032",
        },
        bg: {
          primary: "#1a1a1a",
          "fill-card1": "#262626",
          "fill-card2": "rgba(255, 255, 255, 0.05)",
        },
        fg: {
          primary: "#ffffff",
          secondary: "#a6a6a6",
          tertiary: "#737373",
          brand: "#6c4fff",
        },
        "border-token": {
          primary: "rgba(255, 255, 255, 0.1)",
          secondary: "rgba(255, 255, 255, 0.05)",
          brand: "#6c4fff",
        },
        func: {
          red: "#e95032",
          green: "#14a739",
          yellow: "#fed500",
        },
        "brand-dark": "#0a0a0a",
      },
      fontFamily: {
        sans: ["var(--font-stack)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        language: ["var(--font-language)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.8s ease-out forwards",
        "fade-in-scale": "fade-in-scale 1s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 8s ease-in-out infinite",
        "glow-pulse": "glow-pulse 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
