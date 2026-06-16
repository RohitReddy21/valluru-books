import { cp, copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
const publicPdfjsDir = join(scriptDir, "..", "public", "pdfjs");

await mkdir(publicPdfjsDir, { recursive: true });
await copyFile(
  join(pdfjsRoot, "build", "pdf.worker.min.mjs"),
  join(publicPdfjsDir, "pdf.worker.min.mjs")
);

for (const directory of ["cmaps", "iccs", "image_decoders", "standard_fonts", "wasm"]) {
  await cp(join(pdfjsRoot, directory), join(publicPdfjsDir, directory), {
    force: true,
    recursive: true
  });
}

console.log("PDF.js assets copied to public/pdfjs.");
