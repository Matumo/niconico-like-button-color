import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMutationObserver } from "@test/unit/observer/helpers/fake-mutation-observer";

// 実装の分岐だけを検証するため、実CSSではなく用途が判別しやすい固定値を使う
// selector自体の妥当性はconfig.test.ts、実DOMとの結合はbrowser-headlessで検証する
const TEST_SELECTORS = {
  likeButton: "sel:watch-button",
  likeButtonContainer: "sel:watch-container",
  fullscreenChangeTarget: "sel:fullscreen",
  shortsActiveEntry: "sel:shorts-active",
  shortsLikeButton: "sel:shorts-like",
};

// MutationObserver発火の前後で書き換える仮想DOM状態
// querySelectorの返り値をstate経由にし、DOM差し替えを同期的に再現する
type DomState = {
  href: string;
  watchButton: Element | null;
  watchContainer: Element | null;
  fullscreenTarget: Element | null;
  shortsActiveEntry: Element | null;
  body: Element | null;
  documentElement: Element;
};

// container.tsの分岐だけに焦点を当てる最小URLパターン
// 正規表現そのものの境界値はconfig.test.tsで実configに対して検証する
const WATCH_URL_PATTERN = /^https:\/\/www\.nicovideo\.jp\/watch\/.+$/;
const SHORTS_URL_PATTERN = /^https:\/\/www\.nicovideo\.jp\/shorts\/.+$/;

// container.tsはモジュールスコープにobserver参照を持つため、import前に依存を差し替え、
// button監視の開始・解除とログ出力だけを観測可能にする
const mockContainerDeps = ({
  startLikeButtonObserver,
  resetLikeButtonObservers,
  debug,
}: {
  startLikeButtonObserver: ReturnType<typeof vi.fn>;
  resetLikeButtonObservers?: ReturnType<typeof vi.fn>;
  debug?: ReturnType<typeof vi.fn>;
}): void => {
  vi.doMock("@main/config/config", () => ({
    config: {
      nicoVideoPageUrlPatternRegExp: WATCH_URL_PATTERN,
      nicoShortsPageUrlPatternRegExp: SHORTS_URL_PATTERN,
    },
    selectors: TEST_SELECTORS,
  }));
  vi.doMock("@main/observer/button", () => ({
    startLikeButtonObserver,
    resetLikeButtonObservers: resetLikeButtonObservers ?? vi.fn(),
  }));
  vi.doMock("@main/util/logger", () => ({
    default: { debug: debug ?? vi.fn() },
  }));
};

// jsdomへ依存せず、container.tsが読むglobalだけをstate付きで用意する
// FakeMutationObserverはobserve条件、disconnect、任意タイミングのcallback発火を記録する
const setupContainerEnv = (state: DomState): void => {
  vi.stubGlobal("location", {
    get href(): string {
      return state.href;
    },
  });
  vi.stubGlobal("document", {
    querySelector: vi.fn((selector: string) => {
      if (selector === TEST_SELECTORS.likeButton) return state.watchButton;
      if (selector === TEST_SELECTORS.likeButtonContainer) return state.watchContainer;
      if (selector === TEST_SELECTORS.fullscreenChangeTarget) return state.fullscreenTarget;
      if (selector === TEST_SELECTORS.shortsActiveEntry) return state.shortsActiveEntry;
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

// 同じrootのままactive entryだけが切り替わる、実サイトの仮想playlistを再現する
// callback発火時には必ずstate上の最新active entryを返す
const createPlaylistRoot = (state: DomState): Element =>
  ({
    querySelector: vi.fn((selector: string) =>
      selector === TEST_SELECTORS.shortsActiveEntry ? state.shortsActiveEntry : null,
    ),
  }) as unknown as Element;

// parentElementの有無とshorts likeのmount/unmountを個別に制御する最小entry
// button=nullは、likeを持たない広告またはロード中のactive entryを表す
const createShortsEntry = (playlistRoot: Element | null, button: Element | null): Element =>
  ({
    parentElement: playlistRoot,
    querySelector: vi.fn((selector: string) =>
      selector === TEST_SELECTORS.shortsLikeButton ? button : null,
    ),
  }) as unknown as Element;

describe("コンテナ監視", () => {
  beforeEach(() => {
    // module cacheとglobal、FakeMutationObserverの生成履歴をケース間で共有しない
    // これによりobserverの生成順とdisconnect回数を意味のあるassert対象に保つ
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    FakeMutationObserver.reset();
  });

  it("監視対象外URLでは即時終了する", async () => {
    const startLikeButtonObserver = vi.fn();
    mockContainerDeps({ startLikeButtonObserver });
    setupContainerEnv({
      href: "https://example.com",
      watchButton: {} as Element,
      watchContainer: {} as Element,
      fullscreenTarget: {} as Element,
      shortsActiveEntry: null,
      body: {} as Element,
      documentElement: {} as Element,
    });

    const { startContainerObservers } = await import("@main/observer/container");
    // 対象DOMが存在していても、対象外URLなら監視を一切作らない
    startContainerObservers();

    expect(FakeMutationObserver.instances).toHaveLength(0);
    expect(startLikeButtonObserver).not.toHaveBeenCalled();
  });

  it("watchの必要要素が揃っている場合に既存監視を開始・差し替えする", async () => {
    const startLikeButtonObserver = vi.fn();
    const debug = vi.fn();
    const firstButton = {} as Element;
    const secondButton = {} as Element;
    const state: DomState = {
      href: "https://www.nicovideo.jp/watch/sm9",
      watchButton: firstButton,
      watchContainer: {} as Element,
      fullscreenTarget: {} as Element,
      shortsActiveEntry: null,
      body: {} as Element,
      documentElement: {} as Element,
    };
    mockContainerDeps({ startLikeButtonObserver, debug });
    setupContainerEnv(state);

    const { startContainerObservers } = await import("@main/observer/container");
    // 初回startでfullscreen監視・button探索監視を作り、現在のbuttonへ即時バインドする
    startContainerObservers();

    expect(FakeMutationObserver.instances).toHaveLength(2);
    expect(startLikeButtonObserver).toHaveBeenCalledWith(firstButton);
    const firstFullscreenObserver = FakeMutationObserver.instances[0];
    const firstFindButtonObserver = FakeMutationObserver.instances[1];

    // URLイベントの重複を想定し、再startで古いDOM observerだけが破棄されることを確認する
    startContainerObservers();
    expect(firstFullscreenObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(firstFindButtonObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(startLikeButtonObserver).toHaveBeenCalledTimes(1);

    const nextFullscreenObserver = FakeMutationObserver.instances[2];
    const nextFindButtonObserver = FakeMutationObserver.instances[3];
    // フルスクリーン切替中にbuttonが一時消えても、存在しない要素へバインドしない
    // watch経路では従来どおり、後続mutationで新buttonが現れるのを待つ
    state.watchButton = null;
    nextFullscreenObserver.trigger();
    expect(debug).toHaveBeenCalledWith("Fullscreen change detected.");

    // 新button出現後は再バインドする
    // 同じDOMを二つのobserverが検出しても、prevButtonElementによりstartLikeButtonObserverは一度しか呼ばれない
    state.watchButton = secondButton;
    nextFullscreenObserver.trigger();
    nextFindButtonObserver.trigger();
    expect(startLikeButtonObserver).toHaveBeenCalledTimes(2);
    expect(startLikeButtonObserver).toHaveBeenLastCalledWith(secondButton);
  });

  it("watchの必要要素をdocumentElementで待機してから監視を開始する", async () => {
    const startLikeButtonObserver = vi.fn();
    const readyButton = {} as Element;
    const docElement = {} as Element;
    const state: DomState = {
      href: "https://www.nicovideo.jp/watch/sm9",
      watchButton: readyButton,
      watchContainer: null,
      fullscreenTarget: null,
      shortsActiveEntry: null,
      body: null,
      documentElement: docElement,
    };
    mockContainerDeps({ startLikeButtonObserver });
    setupContainerEnv(state);

    const { startContainerObservers } = await import("@main/observer/container");
    // bootstrap直後でbodyがまだ無いケース
    // documentElementを監視rootへフォールバックする
    // button自体はあっても、containerとfullscreen targetが揃うまでは次段へ進まない
    startContainerObservers();
    const initObserver = FakeMutationObserver.instances[0];
    expect(initObserver.observe).toHaveBeenCalledWith(docElement, {
      childList: true,
      subtree: true,
    });

    // containerだけが先に生成された段階では待機observerを維持する
    state.watchContainer = {} as Element;
    initObserver.trigger();
    expect(startLikeButtonObserver).not.toHaveBeenCalled();

    // 最後の必須要素が揃った時点で待機を終了し、watch用の二つのobserverへ移行する
    state.fullscreenTarget = {} as Element;
    initObserver.trigger();
    expect(initObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(FakeMutationObserver.instances).toHaveLength(3);
    expect(startLikeButtonObserver).toHaveBeenCalledWith(readyButton);
  });

  it("shortsのactive entryを継続監視し、通常切替・広告・復帰へ追従する", async () => {
    const startLikeButtonObserver = vi.fn();
    const resetLikeButtonObservers = vi.fn();
    const state: DomState = {
      href: "https://www.nicovideo.jp/shorts/ss1",
      watchButton: null,
      watchContainer: null,
      fullscreenTarget: null,
      shortsActiveEntry: null,
      body: {} as Element,
      documentElement: {} as Element,
    };
    // playlist rootは維持したままactive entry/buttonだけを差し替える
    // first/second/thirdは通常short、button=nullは広告entryを表す
    const playlistRoot = createPlaylistRoot(state);
    const firstButton = {} as Element;
    const secondButton = {} as Element;
    const thirdButton = {} as Element;
    state.shortsActiveEntry = createShortsEntry(playlistRoot, firstButton);
    mockContainerDeps({ startLikeButtonObserver, resetLikeButtonObservers });
    setupContainerEnv(state);

    const { startContainerObservers } = await import("@main/observer/container");
    // active entryが初めからある場合は待機observerを作らずplaylist監視へ直行する
    startContainerObservers();
    const playlistObserver = FakeMutationObserver.instances[0];

    expect(playlistObserver.observe).toHaveBeenCalledWith(playlistRoot, {
      attributes: true,
      attributeFilter: ["data-playlist-state"],
      childList: true,
      subtree: true,
    });
    expect(startLikeButtonObserver).toHaveBeenCalledWith(firstButton);

    // 同じactive buttonのまま無関係なmutationが来ても二重バインドしない
    playlistObserver.trigger();
    expect(startLikeButtonObserver).toHaveBeenCalledTimes(1);

    // 通常short切替: 新しいactive buttonへ監視対象を移す
    state.shortsActiveEntry = createShortsEntry(playlistRoot, secondButton);
    playlistObserver.trigger();
    expect(startLikeButtonObserver).toHaveBeenLastCalledWith(secondButton);

    // 広告切替: URLは変化しないがactive entryからlikeが消えるため、
    // 旧shortのbutton observerを明示的に解除する
    state.shortsActiveEntry = createShortsEntry(playlistRoot, null);
    playlistObserver.trigger();
    expect(resetLikeButtonObservers).toHaveBeenCalledTimes(1);

    // 広告中の追加mutationでは、解除済みobserverを何度もresetしない
    playlistObserver.trigger();
    expect(resetLikeButtonObservers).toHaveBeenCalledTimes(1);

    // 広告終了: 次の通常shortにlikeがmountされたら新buttonへ再バインドする
    state.shortsActiveEntry = createShortsEntry(playlistRoot, thirdButton);
    playlistObserver.trigger();
    expect(startLikeButtonObserver).toHaveBeenCalledTimes(3);
    expect(startLikeButtonObserver).toHaveBeenLastCalledWith(thirdButton);
  });

  it("shortsのactive entryと親要素の出現を待ってからplaylist監視へ移る", async () => {
    const startLikeButtonObserver = vi.fn();
    const resetLikeButtonObservers = vi.fn();
    const docElement = {} as Element;
    const state: DomState = {
      href: "https://www.nicovideo.jp/shorts/ss1",
      watchButton: null,
      watchContainer: null,
      fullscreenTarget: null,
      shortsActiveEntry: null,
      body: null,
      documentElement: docElement,
    };
    mockContainerDeps({ startLikeButtonObserver, resetLikeButtonObservers });
    setupContainerEnv(state);

    const { startContainerObservers } = await import("@main/observer/container");
    // 個別shortへリダイレクト済みだが、bodyがまだ無い初期描画を想定する
    // documentElement上でactive属性・子要素の両方を監視し、playlist生成を待つ
    startContainerObservers();
    const initObserver = FakeMutationObserver.instances[0];
    expect(initObserver.observe).toHaveBeenCalledWith(docElement, {
      attributes: true,
      attributeFilter: ["data-playlist-state"],
      childList: true,
      subtree: true,
    });

    // active entryだけ先に見えてもparentElementが無ければ、安定した監視rootを作れない
    // この段階では待機を継続し、存在しないbutton observerをresetしない
    state.shortsActiveEntry = createShortsEntry(null, null);
    initObserver.trigger();
    expect(FakeMutationObserver.instances).toHaveLength(1);
    expect(resetLikeButtonObservers).not.toHaveBeenCalled();

    // entryがplaylistへ接続された時点で待機observerからplaylist observerへ移行する
    const playlistRoot = createPlaylistRoot(state);
    const button = {} as Element;
    state.shortsActiveEntry = createShortsEntry(playlistRoot, button);
    initObserver.trigger();

    expect(initObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(FakeMutationObserver.instances).toHaveLength(2);
    expect(startLikeButtonObserver).toHaveBeenCalledWith(button);
  });

  it("shortsが広告entryから始まる場合は不要なbutton resetを行わない", async () => {
    const startLikeButtonObserver = vi.fn();
    const resetLikeButtonObservers = vi.fn();
    const state: DomState = {
      href: "https://www.nicovideo.jp/shorts/ss1",
      watchButton: null,
      watchContainer: null,
      fullscreenTarget: null,
      shortsActiveEntry: null,
      body: {} as Element,
      documentElement: {} as Element,
    };
    // 初期表示が広告の場合は「以前のbutton」が存在しないため、
    // playlistは監視するがresetLikeButtonObserversを無駄に呼ばない
    const playlistRoot = createPlaylistRoot(state);
    state.shortsActiveEntry = createShortsEntry(playlistRoot, null);
    mockContainerDeps({ startLikeButtonObserver, resetLikeButtonObservers });
    setupContainerEnv(state);

    const { startContainerObservers } = await import("@main/observer/container");
    startContainerObservers();

    expect(FakeMutationObserver.instances).toHaveLength(1);
    expect(startLikeButtonObserver).not.toHaveBeenCalled();
    expect(resetLikeButtonObservers).not.toHaveBeenCalled();
  });

  it("多重startとresetで全observerを停止し、同一ボタンでも再初期化できる", async () => {
    const startLikeButtonObserver = vi.fn();
    const resetLikeButtonObservers = vi.fn();
    const state: DomState = {
      href: "https://www.nicovideo.jp/shorts/ss1",
      watchButton: null,
      watchContainer: null,
      fullscreenTarget: null,
      shortsActiveEntry: null,
      body: {} as Element,
      documentElement: {} as Element,
    };
    const playlistRoot = createPlaylistRoot(state);
    const button = {} as Element;
    state.shortsActiveEntry = createShortsEntry(playlistRoot, button);
    mockContainerDeps({ startLikeButtonObserver, resetLikeButtonObservers });
    setupContainerEnv(state);

    const { startContainerObservers, resetContainerObservers } = await import("@main/observer/container");
    // 1回目のstartでplaylist observerとbutton observerを作る
    startContainerObservers();
    const firstPlaylistObserver = FakeMutationObserver.instances[0];

    // 2回目のstartは古いplaylist observerを切り、同一buttonの二重初期化を避ける
    startContainerObservers();
    expect(firstPlaylistObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(startLikeButtonObserver).toHaveBeenCalledTimes(1);
    const secondPlaylistObserver = FakeMutationObserver.instances[1];

    // 明示resetは現在のplaylist observerとbutton observerの双方を停止する
    resetContainerObservers();
    expect(secondPlaylistObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(resetLikeButtonObservers).toHaveBeenCalledTimes(1);

    // reset後はprevButtonElementも破棄済みなので、同じDOMノードへ再バインドできる
    startContainerObservers();
    expect(startLikeButtonObserver).toHaveBeenCalledTimes(2);
    expect(startLikeButtonObserver).toHaveBeenLastCalledWith(button);
  });

  it("待機中のresetでinit observerを停止する", async () => {
    const startLikeButtonObserver = vi.fn();
    const resetLikeButtonObservers = vi.fn();
    const state: DomState = {
      href: "https://www.nicovideo.jp/shorts/ss1",
      watchButton: null,
      watchContainer: null,
      fullscreenTarget: null,
      shortsActiveEntry: null,
      body: {} as Element,
      documentElement: {} as Element,
    };
    mockContainerDeps({ startLikeButtonObserver, resetLikeButtonObservers });
    setupContainerEnv(state);

    const { startContainerObservers, resetContainerObservers } = await import("@main/observer/container");
    // active entry待機中のURL変更を想定し、未使用のinit observerも確実に停止する
    startContainerObservers();
    const initObserver = FakeMutationObserver.instances[0];
    resetContainerObservers();

    expect(initObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(resetLikeButtonObservers).toHaveBeenCalledTimes(1);
    expect(startLikeButtonObserver).not.toHaveBeenCalled();
  });
});
