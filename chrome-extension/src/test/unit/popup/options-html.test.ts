// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const optionsHtmlPath = resolve(process.cwd(), "chrome-extension/popup/options.html");
const requiredElementSelectors = ["#title", "#selectColors", "#save", "#message"] as const;

const readOptionsDocument = (): Document => {
  const html = readFileSync(optionsHtmlPath, "utf8");
  return new DOMParser().parseFromString(html, "text/html");
};

describe("popup options.html", () => {
  it("popup初期化に必要なDOM要素を持つ", () => {
    const document = readOptionsDocument();

    requiredElementSelectors.forEach((selector) => {
      expect(document.querySelector(selector), selector).not.toBeNull();
    });
    expect(document.querySelector<HTMLButtonElement>("#save")?.type).toBe("button");
  });

  it("popupのmodule scriptがbootstrapOptionsPageを読み込む", () => {
    const document = readOptionsDocument();
    const moduleScript = document.querySelector<HTMLScriptElement>('script[type="module"]');

    expect(moduleScript).not.toBeNull();
    expect(moduleScript?.textContent).toContain('import { bootstrapOptionsPage } from "@main/popup/options"');
    expect(moduleScript?.textContent).toContain("void bootstrapOptionsPage();");
    expect(document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')?.getAttribute("href")).toBe(
      "./options.css",
    );
  });
});
