import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f0e0c",
        surface: "#1a1815",
        parchment: "#e8e0d4",
        muted: "#9a9080",
        gold: "#c4a96b",
        /**
         * The printed booklet, sampled from the PDFs themselves: the paper fill, the ink
         * the body is set in, the darker ink of a chapter opening, and the gold of the
         * MEANING / భావము section headers. The reader reproduces the page, so these are
         * the page's own colours rather than the site's dark palette.
         */
        page: {
          paper: "#f7f0e4",
          ink: "#2a2118",
          head: "#22180d",
          gold: "#a17a3e",
          muted: "#8d7a62",
          rule: "#ddd0b8"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Georgia", "serif"],
        label: ["var(--font-label)", "Georgia", "serif"],
        /**
         * What the booklets are typeset in. The Telugu family is listed second rather
         * than given its own class: font fallback is per glyph, so Latin takes Noto Serif
         * and Telugu takes Noto Serif Telugu out of the same stack. Without it the padyam
         * falls back to whatever the browser has, which is how the verse booklets read
         * today.
         */
        page: [
          "var(--font-page)",
          "var(--font-page-telugu)",
          "Noto Serif",
          "Georgia",
          "serif"
        ]
      },
      boxShadow: {
        quiet: "0 22px 70px rgba(0, 0, 0, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
