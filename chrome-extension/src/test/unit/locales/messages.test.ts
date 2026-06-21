import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

type LocaleMessageEntry = {
  message: string;
};

type LocaleMessages = Record<string, LocaleMessageEntry>;

const localesRoot = resolve(process.cwd(), "chrome-extension/public/_locales");
const manifestPath = resolve(process.cwd(), "chrome-extension/public/manifest.json");
const requiredPopupMessageKeys = ["extensionName", "saveButton", "savedMessage"] as const;
const compareStrings = (left: string, right: string): number => left.localeCompare(right);

const readDefaultLocale = (): string => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    default_locale?: string;
  };

  if (!manifest.default_locale) {
    throw new Error("manifest.json is missing default_locale");
  }

  return manifest.default_locale;
};

const readLocaleMessages = (locale: string): LocaleMessages => {
  const localeFile = join(localesRoot, locale, "messages.json");
  return JSON.parse(readFileSync(localeFile, "utf8")) as LocaleMessages;
};

describe("locale messages", () => {
  it("全localeのmessageが空でない", () => {
    const defaultLocale = readDefaultLocale();
    const locales = readdirSync(localesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareStrings);

    expect(locales).toContain(defaultLocale);

    locales.forEach((locale) => {
      const messages = readLocaleMessages(locale);

      expect(Object.keys(messages).length).toBeGreaterThan(0);
      Object.entries(messages).forEach(([key, entry]) => {
        expect(entry.message, `${locale}:${key}`).toEqual(expect.any(String));
        expect(entry.message.trim(), `${locale}:${key}`).not.toBe("");
      });
    });
  });

  it("全localeがdefault localeと同じキーを持つ", () => {
    const defaultLocale = readDefaultLocale();
    const locales = readdirSync(localesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareStrings);
    const defaultMessages = readLocaleMessages(defaultLocale);
    const defaultKeys = Object.keys(defaultMessages).sort(compareStrings);

    locales.forEach((locale) => {
      const localeKeys = Object.keys(readLocaleMessages(locale)).sort(compareStrings);

      expect(localeKeys, locale).toEqual(defaultKeys);
    });
  });

  it("default localeがpopup必須文言キーを持つ", () => {
    const defaultLocale = readDefaultLocale();
    const defaultMessages = readLocaleMessages(defaultLocale);

    requiredPopupMessageKeys.forEach((key) => {
      expect(defaultMessages, key).toHaveProperty(key);
      expect(defaultMessages[key]?.message.trim(), key).not.toBe("");
    });
  });
});
