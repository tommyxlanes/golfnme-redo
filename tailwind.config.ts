import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary - Deep Golf Green
        fairway: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#1d5a3c",
          600: "#16a34a",
          700: "#0f5132",
          800: "#0a3622",
          900: "#052e16",
          950: "#022c14",
        },
        // Accent - Gold
        gold: {
          50: "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#d4af37",
          500: "#c9a227",
          600: "#a37e1c",
          700: "#7c5e15",
          800: "#5c4510",
          900: "#3d2e0a",
        },
        // Neutral - Cream/Sand
        sand: {
          50: "#fdfcfa",
          100: "#f9f6f0",
          200: "#f3ede1",
          300: "#e8dfc9",
          400: "#d4c4a5",
          500: "#b8a07a",
          600: "#9a8362",
          700: "#7a684f",
          800: "#5c4e3c",
          900: "#3e342a",
          950: "#1a1612",
        },
        // Dark mode specific
        dark: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#00251c",
          900: "#07191a",
          950: "#020617",
        },
        // Scoring colors
        eagle: "#1d4ed8",
        birdie: "#059669",
        par: "#065f46",
        bogey: "#d97706",
        double: "#dc2626",
        worse: "#7c2d12",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 4px 16px -4px rgba(0, 0, 0, 0.12)",
        "card-hover":
          "0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 8px 24px -4px rgba(0, 0, 0, 0.16)",
        "card-dark":
          "0 2px 8px -2px rgba(0, 0, 0, 0.3), 0 4px 16px -4px rgba(0, 0, 0, 0.4)",
        "card-dark-hover":
          "0 4px 12px -2px rgba(0, 0, 0, 0.4), 0 8px 24px -4px rgba(0, 0, 0, 0.5)",
        "inner-glow": "inset 0 2px 4px 0 rgba(255, 255, 255, 0.1)",
      },
      backgroundImage: {
        "teal-gradient-dark":
          "linear-gradient(135deg, #001012 0%, #03191c 100%)",
        "fairway-gradient": "linear-gradient(135deg, #065f46 0%, #022c22 100%)",
        "fairway-gradient-dark":
          "linear-gradient(135deg, #001012 0%, #00230f 100%)",
        "gold-gradient": "linear-gradient(135deg, #F9E582 0%, #D29737 100%)",
        "gold-gradient-dark":
          "linear-gradient(135deg, #fde047 0%, #c9a227 100%)",
        "sand-texture": 'url("/textures/sand-pattern.svg")',
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "pulse-score": "pulseScore 0.6s ease-out",
        confetti: "confetti 0.8s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseScore: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        confetti: {
          "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
          "100%": {
            transform: "translateY(-100px) rotate(720deg)",
            opacity: "0",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
