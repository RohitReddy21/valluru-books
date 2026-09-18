import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      // Vendored pdf.js build, copied in by `npm run prepare-pdfjs`. Linting a
      // third-party bundle produces thousands of warnings about code we do not own.
      "public/pdfjs/**",
      "public/pdf.worker.min.mjs"
    ]
  }
]);
