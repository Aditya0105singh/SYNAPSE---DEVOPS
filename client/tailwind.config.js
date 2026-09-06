/** @type {import('tailwindcss').Config} */
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: withVar("--surface-0"),
          1: withVar("--surface-1"),
          2: withVar("--surface-2"),
          3: withVar("--surface-3"),
          border: withVar("--surface-border"),
        },
        ink: {
          hi: withVar("--ink-hi"),
          body: withVar("--ink-body"),
          mute: withVar("--ink-mute"),
          faint: withVar("--ink-faint"),
        },
        accent: {
          DEFAULT: "#ff6a1a",
          soft: "#ff8c42",
        },
        status: {
          healthy: withVar("--status-healthy"),
          medium: withVar("--status-medium"),
          high: withVar("--status-high"),
          critical: withVar("--status-critical"),
          offline: withVar("--status-offline"),
          info: withVar("--status-info"),
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.4)",
        glow: "0 0 0 1px rgba(255,106,26,0.3), 0 0 20px rgba(255,106,26,0.15)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.35 },
        },
        flashRow: {
          "0%": { backgroundColor: "rgba(239,68,68,0.25)" },
          "100%": { backgroundColor: "transparent" },
        },
        toastIn: {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
        flashRow: "flashRow 1.2s ease-out",
        toastIn: "toastIn 0.18s ease-out",
      },
    },
  },
  plugins: [],
};
