import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMutationObserver } from "@test/unit/observer/helpers/fake-mutation-observer";

// addEventListenerで登録されるハンドラ保持用マップ
type ListenerMap = Record<string, (event?: unknown) => void>;

// CustomEventを代替する最小モック
class FakeCustomEvent {
  readonly type: string;

  constructor(type: string) {
    this.type = type;
  }
}

// windowとdocumentのモックを状態付きで初期化
const setupWindowDocument = (
  initialHref: string,
  options?: { headIsNull?: boolean; throwOnHrefRead?: () => boolean },
): {
  listeners: ListenerMap;
  setHref: (value: string) => void;
  dispatchEvent: ReturnType<typeof vi.fn>;
} => {
  let href = initialHref;
  const listeners: ListenerMap = {};
  const dispatchEvent = vi.fn();

  // URL参照時の例外発生も再現できるlocationスタブを作る
  const locationObject = {
    get href(): string {
      if (options?.throwOnHrefRead?.()) {
        throw new Error("href read failed");
      }
      return href;
    },
    set href(value: string) {
      href = value;
    },
  };

  vi.stubGlobal("location", locationObject);
  vi.stubGlobal(
    "addEventListener",
    vi.fn((eventName: string, listener: (event?: unknown) => void) => {
      // テスト側で直接呼べるようにイベントハンドラを保持
      listeners[eventName] = listener;
    }),
  );
  vi.stubGlobal("removeEventListener", vi.fn());
  vi.stubGlobal("dispatchEvent", dispatchEvent);
  vi.stubGlobal("document", {
    head: options?.headIsNull ? null : {},
    documentElement: {},
  });
  vi.stubGlobal("CustomEvent", FakeCustomEvent);
  vi.stubGlobal("MutationObserver", FakeMutationObserver);

  return {
    listeners,
    setHref: (value: string) => {
      href = value;
    },
    dispatchEvent,
  };
};

describe("ページ監視", () => {
  beforeEach(() => {
    // モジュールとモックをリセット
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // FakeMutationObserverのインスタンス履歴をリセット
    FakeMutationObserver.reset();
  });

  it("一度だけ開始しURL変更でイベント発火して停止できる", async () => {
    // ログ出力モックとwindow/document環境を準備
    const debug = vi.fn();
    const env = setupWindowDocument("https://www.nicovideo.jp/watch/sm9");

    // テスト対象が参照する依存モジュールを差し替え
    vi.doMock("@main/config/config", () => ({
      config: { nicoVideoPageUrlChangedEventName: "mock:url:changed" },
    }));
    vi.doMock("@main/util/logger", () => ({
      default: { debug },
    }));

    // テスト対象をインポート
    const { startPageUrlObserver, stopPageUrlObserver } = await import("@main/observer/page");

    // 停止処理は未開始でも安全に呼べることを確認
    stopPageUrlObserver();

    // 2回呼んでもobserverは増えないことを確認
    startPageUrlObserver();
    startPageUrlObserver();

    expect(FakeMutationObserver.instances).toHaveLength(1);
    const observer = FakeMutationObserver.instances[0];

    // URL変更がないpopstateではイベントが発火しないことを確認
    env.listeners.popstate?.();
    expect(env.dispatchEvent).not.toHaveBeenCalled();

    // URL変更時のみイベント通知されることを確認
    env.setHref("https://www.nicovideo.jp/watch/sm10");
    observer.trigger();

    expect(env.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(env.dispatchEvent.mock.calls[0]?.[0]).toBeInstanceOf(FakeCustomEvent);
    expect(debug).toHaveBeenCalledWith(
      "NicoVideo page URL changed:",
      "https://www.nicovideo.jp/watch/sm10",
    );

    // stop後はobserverが切断され再stopでも例外にならないことを確認
    stopPageUrlObserver();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);

    stopPageUrlObserver();
  });

  it("documentElementへフォールバックしURL確認エラーを記録する", async () => {
    // ログ出力モックと例外発生を切り替えるフラグを準備
    const debug = vi.fn();
    const warn = vi.fn();
    let shouldThrow = false;

    // head不在とURL参照エラーを再現できるwindow/document環境を準備
    setupWindowDocument("https://www.nicovideo.jp/watch/sm9", {
      headIsNull: true,
      throwOnHrefRead: () => shouldThrow,
    });

    // テスト対象が参照する依存モジュールを差し替え
    vi.doMock("@main/config/config", () => ({
      config: { nicoVideoPageUrlChangedEventName: "mock:url:changed" },
    }));
    vi.doMock("@main/util/logger", () => ({
      default: { debug, warn },
    }));

    // テスト対象をインポート
    const { startPageUrlObserver } = await import("@main/observer/page");
    startPageUrlObserver();

    // headが無い環境ではdocumentElementを監視対象に使うことを確認
    const observer = FakeMutationObserver.instances[0];
    expect(observer.observe.mock.calls[0]?.[0]).toEqual({});

    // URL読み取り失敗時はwarnが記録されることを確認
    shouldThrow = true;
    observer.trigger();

    expect(warn).toHaveBeenCalledWith("Failed to check URL change:", expect.any(Error));
  });
});
