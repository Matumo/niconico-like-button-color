import { beforeEach, describe, expect, it, vi } from "vitest";

describe("メイン初期化", () => {
  beforeEach(() => {
    // モジュールとモックをリセット
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("bootstrapを実行してURL変更イベントに反応する", async () => {
    // bootstrap内で呼ばれる処理を観測するためのモックを準備
    const fetchLikeButtonColor = vi.fn().mockResolvedValue("#FF8FA8");
    const init = vi.fn();
    const startPageUrlObserver = vi.fn();
    const debug = vi.fn();
    const listeners: Record<string, () => void> = {};

    // bootstrapが依存する各モジュールをすべてテストダブルに差し替え
    vi.doMock("@main/config/config", () => ({
      config: {
        nicoVideoPageUrlChangedEventName: "mock:url:changed",
      },
    }));
    vi.doMock("@main/config/storage", () => ({
      storage: { fetchLikeButtonColor },
    }));
    vi.doMock("@main/observer/container", () => ({
      init,
    }));
    vi.doMock("@main/observer/page", () => ({
      startPageUrlObserver,
    }));
    vi.doMock("@main/util/logger", () => ({
      default: { debug },
    }));

    const addEventListener = vi.fn((eventName: string, listener: () => void) => {
      // 後段で手動発火できるようにイベントリスナーを保持
      listeners[eventName] = listener;
    });
    vi.stubGlobal("addEventListener", addEventListener);

    // テスト対象をインポート
    await import("@main/main");
    // 非同期で連鎖する初期化処理が完了するまで1ティック待機
    await Promise.resolve();

    // 初期化処理が期待通り実行されていることを検証
    expect(fetchLikeButtonColor).toHaveBeenCalledTimes(1);
    expect(startPageUrlObserver).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);

    // 登録済みハンドラーを直接呼び、再初期化経路を検証
    listeners["mock:url:changed"]?.();

    // URL変更イベント時のログ出力と再初期化を検証
    expect(debug).toHaveBeenCalledWith("Change nico video page URL event.");
    expect(init).toHaveBeenCalledTimes(2);
  });
});
