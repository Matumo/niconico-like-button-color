import { describe, expect, it, vi } from "vitest";
import * as parser from "postcss-selector-parser";

describe("設定エクスポート", () => {
  it("configとselectorsがエクスポートされ必須フィールドがnullではない", async () => {
    // モジュール初期化の副作用差分を避けるため毎回読込
    vi.resetModules();
    const { config, selectors } = await import("@main/config/config");

    // エクスポート自体できていることを確認
    expect(config).toBeTruthy();
    expect(selectors).toBeTruthy();

    // 設定項目が空でないことと各値の存在を確認
    const configKeys = Object.keys(config) as Array<keyof typeof config>;
    expect(configKeys.length).toBeGreaterThan(0);
    for (const key of configKeys) {
      expect(config[key]).not.toBeNull();
      expect(config[key]).not.toBeUndefined();
    }

    // selectorsの各エントリが存在して、正しいセレクタであることを確認
    const selectorKeys = Object.keys(selectors) as Array<keyof typeof selectors>;
    expect(selectorKeys.length).toBeGreaterThan(0);
    // CJS/ESMどちらでも動くようdefault差分を吸収
    type ParserFactory = () => { astSync: (selector: string) => unknown };
    const parserFactory =
      ((parser as unknown as { default?: ParserFactory }).default ??
        (parser as unknown as ParserFactory));
    for (const key of selectorKeys) {
      expect(selectors[key]).not.toBeNull();
      expect(selectors[key]).not.toBeUndefined();
      expect(() => parserFactory().astSync(selectors[key])).not.toThrow();
    }
  });
});
