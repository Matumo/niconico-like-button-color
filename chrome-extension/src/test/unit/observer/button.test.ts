import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMutationObserver } from "@test/unit/observer/helpers/fake-mutation-observer";

// テストでモックするSVGPathElementの最小構成
type MockSvgPathBase = Pick<
  SVGPathElement,
  "setAttribute" | "removeAttribute" | "getAttribute"
>;

// 各メソッドをvi.fnで置き換えたモックpath型
type MockSvgPath = {
  [K in keyof MockSvgPathBase]: ReturnType<typeof vi.fn<MockSvgPathBase[K]>>;
};

// 疑似ボタンから取得する状態
type ButtonState = {
  params: string | null;
  path: MockSvgPath | null;
};

// fill属性を保持できる疑似pathを生成
const createPath = (): MockSvgPath => {
  // fill属性の状態をテスト内で追えるようにクローズド変数で保持
  let fill: string | null = null;

  return {
    setAttribute: vi.fn((name: string, value: string) => {
      if (name === "fill") {
        fill = value;
      }
    }),
    removeAttribute: vi.fn((name: string) => {
      if (name === "fill") {
        fill = null;
      }
    }),
    getAttribute: vi.fn((name: string) => (name === "fill" ? fill : null)),
  };
};

// paramsとpathを返す疑似ボタン要素を生成
const createButton = (state: ButtonState): Element =>
  // 実DOMの代わりに最小限のAPIだけを持つ疑似ボタンを返す
  ({
    get dataset(): DOMStringMap {
      return {
        elementParams: state.params ?? undefined,
      } as DOMStringMap;
    },
    querySelector: vi.fn((selector: string) => (selector === "svg path" ? state.path : null)),
  }) as unknown as Element;

describe("ボタン監視", () => {
  beforeEach(() => {
    // モジュールとモックをリセット
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    // FakeMutationObserverのインスタンス履歴をリセット
    FakeMutationObserver.reset();
  });

  it("色を更新して変更監視に反応する", async () => {
    // ログ出力と色情報取得のモックを準備
    const debug = vi.fn();
    const warn = vi.fn();
    const getLikeButtonColor = vi.fn(() => "#AA22BB");

    // テスト対象が参照する依存モジュールを差し替え
    vi.doMock("@main/util/logger", () => ({
      default: { debug, warn },
    }));
    vi.doMock("@main/config/storage", () => ({
      storage: { getLikeButtonColor },
    }));
    vi.stubGlobal("MutationObserver", FakeMutationObserver);

    // テスト対象をインポート
    const { startButtonCheckObserver } = await import("@main/observer/button");

    // current=true（いいね有り）の状態で初回色適用と監視開始を検証
    const state1: ButtonState = {
      params: "{\"current\":true}",
      path: createPath(),
    };
    const button1 = createButton(state1); // 初回監視対象のボタン
    startButtonCheckObserver(button1); // 監視開始（初期色適用とobserver登録）

    // current=true（いいね有り）なのでfill属性に保存色が設定されることを確認
    expect(state1.path?.setAttribute).toHaveBeenCalledWith("fill", "#AA22BB");
    // 監視開始によりobserverインスタンスが1件作成されることを確認
    expect(FakeMutationObserver.instances).toHaveLength(1);

    // 登録されたobserverを取り出し、以降のイベント発火検証に使う
    const firstObserver = FakeMutationObserver.instances[0];
    // 以降で「更新されないこと」を比較するため現在の呼び出し回数を保持
    const beforeNoop = state1.path?.setAttribute.mock.calls.length ?? 0;

    // 拡張機能が行ったfill属性更新が再処理されないことを確認（再処理されると無限ループになる）
    firstObserver.trigger([
      {
        type: "attributes",
        target: state1.path as unknown as Node,
        attributeName: "fill",
      } as unknown as MutationRecord,
    ]);
    expect(state1.path?.setAttribute.mock.calls.length).toBe(beforeNoop);

    // current（いいねの有無）が変わらない場合も更新しないことを確認
    firstObserver.trigger([
      {
        type: "childList",
        target: button1 as unknown as Node,
      } as unknown as MutationRecord,
    ]);
    expect(state1.path?.setAttribute.mock.calls.length).toBe(beforeNoop);

    // current=false（いいね無し）になったらfillを除去することを確認
    state1.params = "{\"current\":false}";
    firstObserver.trigger([
      {
        type: "childList",
        target: button1 as unknown as Node,
      } as unknown as MutationRecord,
    ]);
    expect(state1.path?.removeAttribute).toHaveBeenCalledWith("fill");

    // SVG要素差し替え時は新しいpathへ色設定し直すことを確認
    const secondPath = createPath();
    state1.params = "{\"current\":true}";
    state1.path = secondPath;
    firstObserver.trigger([
      {
        type: "childList",
        target: button1 as unknown as Node,
      } as unknown as MutationRecord,
    ]);
    expect(secondPath.setAttribute).toHaveBeenCalledWith("fill", "#AA22BB");

    // 別ボタンに切り替えたときは以前のobserverを切断することを確認
    const state2: ButtonState = {
      params: "{\"current\":false}",
      path: createPath(),
    };
    const button2 = createButton(state2);
    startButtonCheckObserver(button2);

    expect(firstObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(state2.path?.removeAttribute).toHaveBeenCalledWith("fill");
    expect(warn).not.toHaveBeenCalled();
  });

  it("resetObserversでオブザーバー停止を多重呼び出しでも壊れない", async () => {
    // ログ出力と色情報取得のモックを準備
    const debug = vi.fn();
    const warn = vi.fn();
    const getLikeButtonColor = vi.fn(() => "#AA22BB");

    // テスト対象が参照する依存モジュールを差し替え
    vi.doMock("@main/util/logger", () => ({
      default: { debug, warn },
    }));
    vi.doMock("@main/config/storage", () => ({
      storage: { getLikeButtonColor },
    }));
    vi.stubGlobal("MutationObserver", FakeMutationObserver);

    // テスト対象をインポート
    const { resetObservers, startButtonCheckObserver } = await import("@main/observer/button");

    // 監視開始後にresetObserversで切断されることを確認
    const state: ButtonState = {
      params: "{\"current\":true}",
      path: createPath(),
    };
    startButtonCheckObserver(createButton(state));
    expect(FakeMutationObserver.instances).toHaveLength(1);

    const observer = FakeMutationObserver.instances[0];
    resetObservers();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);

    // 連続呼び出ししても追加の切断や例外が発生しないことを確認
    resetObservers();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("svgやparams不足と不正paramsを処理する", async () => {
    // ログ出力のモックを準備
    const debug = vi.fn();
    const warn = vi.fn();

    // テスト対象が参照する依存モジュールを差し替え
    vi.doMock("@main/util/logger", () => ({
      default: { debug, warn },
    }));
    vi.doMock("@main/config/storage", () => ({
      storage: { getLikeButtonColor: vi.fn(() => "#AA22BB") },
    }));
    vi.stubGlobal("MutationObserver", FakeMutationObserver);

    // テスト対象をインポート
    const { startButtonCheckObserver } = await import("@main/observer/button");

    // 参照データが不足している場合は処理をスキップすることを確認
    const missingState: ButtonState = {
      params: null,
      path: null,
    };
    startButtonCheckObserver(createButton(missingState));

    expect(debug).toHaveBeenCalledWith("Skipping update. svgPath or currentStatus is missing.");

    // JSON解析失敗時はwarnを出して落ちないことを確認
    const invalidState: ButtonState = {
      params: "{not-json}",
      path: createPath(),
    };
    startButtonCheckObserver(createButton(invalidState));

    expect(warn).toHaveBeenCalledWith(
      "Failed to parse data-element-params:",
      expect.any(SyntaxError),
    );
    expect(debug).toHaveBeenCalledWith("Skipping update. svgPath or currentStatus is missing.");
  });
});
