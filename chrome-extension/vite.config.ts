import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

export default defineConfig({
  root: resolve(projectRoot, "chrome-extension"),
  publicDir: "public",
  resolve: {
    alias: {
      "@main": resolve(projectRoot, "chrome-extension/src/main"),
      "@test": resolve(projectRoot, "chrome-extension/src/test"),
    },
  },
  build: {
    outDir: resolve(projectRoot, "dist/chrome-extension"),
    emptyOutDir: true,
    minify: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(projectRoot, "chrome-extension/src/main/main.ts"),
      },
      output: {
        entryFileNames: "src/main/[name].js",
      },
    },
  },
});
