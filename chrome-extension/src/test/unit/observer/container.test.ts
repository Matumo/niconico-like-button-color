import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMutationObserver } from "@test/unit/observer/helpers/fake-mutation-observer";

const WATCH_URL_PATTERN = /^https:\/\/www\.nicovideo\.jp\/watch\/.+$/;
const TEST_SELECTORS = {
  likeButton: "sel:button",
  likeButtonContainer: "sel:container",
  fullscreenChangeTarget: "sel:fullscreen",
};

// コンテナ監視テストで参照するDOM状態
type DomState = {
  href: string;
  button: Element | null;
  container: Element | null;
  fullscreenTarget: Element | null;
  body: Element | null;
  documentElement: Element;
};

// コンテナ監視が参照する依存モジュールをまとめて差し替え
const mockContainerDeps = ({
  startButtonCheckObserver,
  debug,
}: {
  startButtonCheckObserver: ReturnType<typeof vi.fn>;
  debug?: ReturnType<typeof vi.fn>;
}): void => {
  vi.doMock("@main/config/config", () => ({
    config: { nicoVideoPageUrlPatternRegExp: WATCH_URL_PATTERN },
    selectors: TEST_SELECTORS,
  }));
  vi.doMock("@main/observer/button", () => ({
    startButtonCheckObserver,
  }));
  vi.doMock("@main/util/logger", () => ({
    default: { debug: debug ?? vi.fn() },
  }));
};

// windowとdocumentのモックを状態付きで初期化
const setupContainerEnv = (state: DomState): void => {
  // location.hrefを書き換え可能にしてURL条件分岐を再現
  const location = {
    get href(): string {
      return state.href;
    },
    set href(value: string) {
      state.href = value;
    },
  };

  vi.stubGlobal("location", location);
  vi.stubGlobal("document", {
    querySelector: vi.fn((selector: string) => {
      // 実装側のセレクタに応じて現在状態を返す
      if (selector === "sel:button") {
        return state.button;
      }
      if (selector === "sel:container") {
        return state.container;
      }
      if (selector === "sel:fullscreen") {
        return state.fullscreenTarget;
      }
      return null;
    }),
    get body(): Element | null {
      return state.body;
    },
    get documentElement(): Element {
      return state.documentElement;
    },
  });
  vi.stubGlobal("MutationObserver", FakeMutationObserver);
};

describe("コンテナ監視", () => {
  beforeEach(() => {
    // モジュールとモックをリセット
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // FakeMutationObserverのインスタンス履歴をリセット
    FakeMutationObserver.reset();
  });

  it("監視対象外URLでは即時終了する", async () => {
    // ボタン監視開始処理のモックを準備
    const startButtonCheckObserver = vi.fn();

    // テスト対象が参照する依存モジュールを差し替え
    mockContainerDeps({ startButtonCheckObserver });

    setupContainerEnv({
      href: "https://example.com",
      button: {} as Element,
      container: {} as Element,
      fullscreenTarget: {} as Element,
      body: {} as Element,
      documentElement: {} as Element,
    });

    // テスト対象をインポート
    const { init } = await import("@main/observer/container");

    // URLが対象外ならobserverが一つも作られないことを確認
    init();
    expect(FakeMutationObserver.instances).toHaveLength(0);
    expect(startButtonCheckObserver).not.toHaveBeenCalled();
  });

  it("必要要素が揃っている場合に監視を開始する", async () => {
    // 監視開始処理とログ出力のモックを準備
    const startButtonCheckObserver = vi.fn();
    const debug = vi.fn();
    const firstButton = {} as Element;
    const secondButton = {} as Element;

    const state: DomState = {
      href: "https://www.nicovideo.jp/watch/sm9",
      button: firstButton,
      container: {} as Element,
      fullscreenTarget: {} as Element,
      body: {} as Element,
      documentElement: {} as Element,
    };

    // テスト対象が参照する依存モジュールを差し替え
    mockContainerDeps({ startButtonCheckObserver, debug });
    setupContainerEnv(state);

    // テスト対象をインポート
    const { init } = await import("@main/observer/container");

    // 1回目initでfullscreen監視とbutton探索監視が開始されることを確認
    init();
    expect(FakeMutationObserver.instances).toHaveLength(2);
    expect(startButtonCheckObserver).toHaveBeenCalledTimes(1);
    expect(startButtonCheckObserver).toHaveBeenCalledWith(firstButton);

    const firstFullscreenObserver = FakeMutationObserver.instances[0];
    const firstFindButtonObserver = FakeMutationObserver.instances[1];

    // 2回目initでは既存observerが切断され新しいobserverに置き換わることを確認
    init();
    expect(FakeMutationObserver.instances).toHaveLength(4);
    expect(firstFullscreenObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(firstFindButtonObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(startButtonCheckObserver).toHaveBeenCalledTimes(1);

    const secondFullscreenObserver = FakeMutationObserver.instances[2];
    const secondFindButtonObserver = FakeMutationObserver.instances[3];

    // secondFullscreenObserverは再init後に登録されたfullscreen監視
    // ボタンが見つからない状態ではstartButtonCheckObserverが増えないことを確認
    state.button = null;
    secondFullscreenObserver.trigger();
    expect(debug).toHaveBeenCalledWith("Fullscreen change detected.");
    expect(startButtonCheckObserver).toHaveBeenCalledTimes(1);

    // ボタン差し替え後は再度startButtonCheckObserverが呼ばれることを確認
    state.button = secondButton;
    secondFullscreenObserver.trigger();
    expect(startButtonCheckObserver).toHaveBeenCalledTimes(2);
    expect(startButtonCheckObserver).toHaveBeenLastCalledWith(secondButton);

    // secondFindButtonObserverが発火してもbutton監視を重複開始しないことを確認
    secondFindButtonObserver.trigger();
    expect(startButtonCheckObserver).toHaveBeenCalledTimes(2);
  });

  it("bodyがない場合はdocumentElementで待機する", async () => {
    // 監視開始処理のモックと待機復帰用の要素を準備
    const startButtonCheckObserver = vi.fn();
    const readyButton = {} as Element;
    const docElement = {} as Element;
    const state: DomState = {
      href: "https://www.nicovideo.jp/watch/sm9",
      button: readyButton,
      container: null,
      fullscreenTarget: null,
      body: null,
      documentElement: docElement,
    };

    // テスト対象が参照する依存モジュールを差し替え
    mockContainerDeps({ startButtonCheckObserver });
    setupContainerEnv(state);

    // テスト対象をインポート
    const { init } = await import("@main/observer/container");

    // body不在時はdocumentElement監視へフォールバックすることを確認
    init();
    expect(FakeMutationObserver.instances).toHaveLength(1);
    expect(FakeMutationObserver.instances[0].observe).toHaveBeenCalledWith(docElement, {
      childList: true,
      subtree: true,
    });

    // 待機中に再度initした場合も古い待機observerを切断することを確認
    init();
    expect(FakeMutationObserver.instances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(FakeMutationObserver.instances).toHaveLength(2);

    const initElementsObserver = FakeMutationObserver.instances[1];

    // containerのみ揃った段階ではまだ次段監視へ進まないことを確認
    state.container = {} as Element;
    initElementsObserver.trigger();
    expect(startButtonCheckObserver).not.toHaveBeenCalled();

    // 必要要素が揃った時点で待機observerを終了し次段へ移行することを確認
    state.fullscreenTarget = {} as Element;
    initElementsObserver.trigger();

    expect(initElementsObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(FakeMutationObserver.instances).toHaveLength(4);
    expect(startButtonCheckObserver).toHaveBeenCalledTimes(1);
    expect(startButtonCheckObserver).toHaveBeenCalledWith(readyButton);
  });
});
