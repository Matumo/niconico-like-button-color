import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ストレージ", () => {
  beforeEach(() => {
    // モジュールとモックをリセット
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("chrome storageから色を読み込む", async () => {
    // ログ出力とchrome.storage.local.getのモックを準備
    const debug = vi.fn();
    const get = vi.fn().mockResolvedValue({ likeButtonColor: "#12AB34" });

    // テスト対象が参照する依存モジュールを差し替え
    vi.doMock("@main/util/logger", () => ({
      default: { debug },
      log: { debug },
    }));
    vi.stubGlobal("chrome", {
      storage: {
        local: { get },
      },
    });

    // テスト対象をインポート
    const { storage } = await import("@main/config/storage");

    // 初期状態はデフォルト色であることを確認
    expect(storage.getLikeButtonColor()).toBe("#FF8FA8");
    // fetchしてstorageから取得した値を返すことを確認
    await expect(storage.fetchLikeButtonColor()).resolves.toBe("#12AB34");
    expect(get).toHaveBeenCalledWith({ likeButtonColor: "#FF8FA8" });
    expect(debug).toHaveBeenCalledWith("likeButtonColor loaded:", "#12AB34");
    // fetch後はstorageから取得した値（キャッシュ）を返すことを確認
    expect(storage.getLikeButtonColor()).toBe("#12AB34");
  });

  it("保存値が文字列でない場合はデフォルト色へフォールバックする", async () => {
    // ログ出力と不正値を返すchrome.storage.local.getのモックを準備
    const debug = vi.fn();
    const get = vi.fn().mockResolvedValue({ likeButtonColor: 100 });

    // テスト対象が参照する依存モジュールを差し替え
    vi.doMock("@main/util/logger", () => ({
      default: { debug },
      log: { debug },
    }));
    vi.stubGlobal("chrome", {
      storage: {
        local: { get },
      },
    });

    // テスト対象をインポート
    const { storage } = await import("@main/config/storage");

    // 数値など不正値が来ても既定値へ戻ることを確認
    await expect(storage.fetchLikeButtonColor()).resolves.toBe("#FF8FA8");
    expect(storage.getLikeButtonColor()).toBe("#FF8FA8");
    expect(debug).toHaveBeenCalledWith("likeButtonColor loaded:", "#FF8FA8");
  });
});
