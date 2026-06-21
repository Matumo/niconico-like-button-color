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

    // postcss-selector-parserは実行環境によりdefault exportの見え方が異なるため両方を許容する
    // 全selectorを実際にparseし、shorts selector追加時の括弧・quoteミスもここで検出する
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

  // 動画IDを持つwatch URLだけに一致することを確認する
  it.each([
    ["https://www.nicovideo.jp/watch/sm9", true],
    ["https://www.nicovideo.jp/watch/sm9?from=shorts#player", true],
    ["https://www.nicovideo.jp/watch/", false],
    ["https://www.nicovideo.jp/shorts/ss123", false],
    ["https://example.com/watch/sm9", false],
  ])("watch URL %s の一致結果が %s になる", async (href, expected) => {
    // モジュール初期化の副作用差分を避けるため毎回読み込み
    vi.resetModules();
    const { config } = await import("@main/config/config");

    expect(config.nicoVideoPageUrlPatternRegExp.test(href)).toBe(expected);
  });

  // shorts用正規表現は個別shortだけに一致する
  // `/shorts`入口とそのquery/hashは個別URLへリダイレクトされた後のURL変更イベントで処理する
  it.each([
    ["https://www.nicovideo.jp/shorts/ss123", true],
    ["https://www.nicovideo.jp/shorts/ss123?rf=nvpc&rp=shorts#x", true],
    ["https://www.nicovideo.jp/shorts", false],
    ["https://www.nicovideo.jp/shorts/", false],
    ["https://www.nicovideo.jp/shorts?ref=header", false],
    ["https://www.nicovideo.jp/shorts#player", false],
    ["https://www.nicovideo.jp/shorts-foo", false],
    ["https://www.nicovideo.jp/watch/sm9", false],
    ["https://example.com/shorts/ss123", false],
  ])("shorts URL %s の一致結果が %s になる", async (href, expected) => {
    // モジュール初期化の副作用差分を避けるため毎回読込
    vi.resetModules();
    const { config } = await import("@main/config/config");

    expect(config.nicoShortsPageUrlPatternRegExp.test(href)).toBe(expected);
  });
});
