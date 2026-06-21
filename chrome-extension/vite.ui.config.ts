import { defineConfig } from "vite";
import { resolve } from "node:path";
import { alias, chromeExtensionDistRoot, chromeExtensionRoot } from "./vite.shared";

export default defineConfig({
  root: chromeExtensionRoot,
  publicDir: false,
  resolve: {
    alias,
  },
  build: {
    outDir: chromeExtensionDistRoot,
    emptyOutDir: false,
    minify: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(chromeExtensionRoot, "popup/options.html"),
    },
  },
});
