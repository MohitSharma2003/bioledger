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
        serif: ['"Fraunces"', "Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
        sans: ['"Manrope"', "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "SFMono-Regular", "Consolas", "monospace"],
        display: ['"Space Grotesk"', "Manrope", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Deliberate scale: display and headings lean on Fraunces; body on Manrope.
        display: ["clamp(2.35rem, 4.6vw, 4.1rem)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        "page-title": ["clamp(2rem, 3.4vw, 3rem)", { lineHeight: "1.06", letterSpacing: "-0.018em" }],
        "section-title": ["clamp(1.5rem, 2.3vw, 2.05rem)", { lineHeight: "1.12", letterSpacing: "-0.012em" }],
        species: ["clamp(1.45rem, 2.2vw, 1.95rem)", { lineHeight: "1.14", letterSpacing: "-0.01em" }],
        lead: ["clamp(1.1rem, 1.5vw, 1.3rem)", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.65" }],
        meta: ["0.72rem", { lineHeight: "1.4", letterSpacing: "0.06em" }],
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
