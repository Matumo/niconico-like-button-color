import { defineConfig } from "vite";
import { resolve } from "node:path";
import { alias, chromeExtensionDistRoot, chromeExtensionRoot } from "./vite.shared";

export default defineConfig({
  root: chromeExtensionRoot,
  publicDir: "public",
  resolve: {
    alias,
  },
  build: {
    outDir: chromeExtensionDistRoot,
    emptyOutDir: true,
    minify: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(chromeExtensionRoot, "src/main/main.ts"),
      output: {
        entryFileNames: "src/main/main.js",
      },
    },
  },
});
