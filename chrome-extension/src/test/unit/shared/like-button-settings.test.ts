import { describe, expect, it } from "vitest";

import {
  customColorStorageKey,
  defaultCustomColor,
  defaultLikeButtonColor,
  likeButtonColorStorageKey,
  normalizeCustomColor,
  normalizeLikeButtonColor,
  normalizeLikeButtonSettings,
} from "@main/shared/like-button-settings";

describe("like ボタン設定共有モジュール", () => {
  it("保存キーと既定値を公開する", () => {
    expect(likeButtonColorStorageKey).toBe("likeButtonColor");
    expect(customColorStorageKey).toBe("customColor");
    expect(defaultLikeButtonColor).toBe("#FF8FA8");
    expect(defaultCustomColor).toBe("#1E90FF");
  });

  it("色文字列を正規化し、不正値は既定値へフォールバックする", () => {
    expect(normalizeLikeButtonColor("#12ab34")).toBe("#12AB34");
    expect(normalizeLikeButtonColor(100)).toBe(defaultLikeButtonColor);
    expect(normalizeCustomColor("#abc123")).toBe("#ABC123");
    expect(normalizeCustomColor("invalid")).toBe(defaultCustomColor);
  });

  it("設定オブジェクト全体を正規化する", () => {
    expect(
      normalizeLikeButtonSettings({
        likeButtonColor: "#abcdef",
        customColor: null,
      }),
    ).toEqual({
      likeButtonColor: "#ABCDEF",
      customColor: defaultCustomColor,
    });
  });
});
