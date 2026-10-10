/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f3eddd",
        "paper-raised": "#faf5e9",
        "paper-deep": "#e7dcc4",
        sage: "#dfe5d3",
        "sage-deep": "#ccd6ba",
        forest: "#17321f",
        "forest-2": "#1f3d2b",
        moss: "#4f6a3a",
        "moss-soft": "#8a9a63",
        olive: "#7d8f4b",
        ochre: "#b06a2c",
        terracotta: "#a8593a",
        ink: "#16211a",
        muted: "#64705b",
        rule: "rgba(23,50,31,0.14)",
        "rule-strong": "rgba(23,50,31,0.30)",
        alert: "#9c4a34",
      },
      fontFamily: {
        serif: ['"Newsreader"', "Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
        sans: ['"DM Sans"', "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "SFMono-Regular", "Consolas", "monospace"],
      },
      maxWidth: {
        shell: "1500px",
      },
      boxShadow: {
        specimen: "0 1px 0 rgba(23,50,31,0.05), 0 18px 40px -32px rgba(23,50,31,0.5)",
        nav: "0 1px 0 rgba(23,50,31,0.08), 0 10px 26px -24px rgba(23,50,31,0.6)",
      },
    },
  },
  plugins: [],
};
