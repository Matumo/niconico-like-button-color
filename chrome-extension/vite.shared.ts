import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const chromeExtensionRoot = resolve(projectRoot, "chrome-extension");
const chromeExtensionDistRoot = resolve(projectRoot, "dist/chrome-extension");

const alias = {
  "@main": resolve(projectRoot, "chrome-extension/src/main"),
  "@test": resolve(projectRoot, "chrome-extension/src/test"),
} as const;

export { alias, chromeExtensionDistRoot, chromeExtensionRoot };
