import js from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, chrome: "readonly" } },
  },
  // TypeScript plugin recommended settings
  tseslint.configs.recommended,
  {
    // Apply TypeScript parser for TS files
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        tsconfigRootDir,
      },
      globals: { ...globals.browser, chrome: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_+$",
          argsIgnorePattern: "^_+$",
          caughtErrorsIgnorePattern: "^_+$",
          destructuredArrayIgnorePattern: "^_+$",
        },
      ],
    },
  },
]);
