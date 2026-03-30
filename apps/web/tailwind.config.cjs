/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        border: "var(--border)",
        accent: "var(--accent)",
        profit: "var(--profit)",
        loss: "var(--loss)",
        primary: "var(--text-primary)",
        muted: "var(--text-muted)"
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,229,255,0.08), 0 0 32px rgba(0,229,255,0.08)"
      }
    }
  },
  plugins: []
};
