import { vi } from "vitest";

// MutationObserverコールバック互換の関数型
type MutationObserverCallbackLike = (
  mutations: MutationRecord[],
  observer: MutationObserver,
) => void;

// テスト用のMutationObserverモック
class FakeMutationObserver {
  // テストケースごとに生成されたインスタンスを外から参照できるようにする
  static readonly instances: FakeMutationObserver[] = [];

  // コールバックと主要APIのモックを保持
  private readonly callback: MutationObserverCallbackLike;
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn<() => MutationRecord[]>(() => []);

  constructor(callback: MutationObserverCallbackLike) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }

  // 本物のMutationObserverのコールバック実行を手動で再現
  trigger(mutations: MutationRecord[] = []): void {
    this.callback(mutations, this as unknown as MutationObserver);
  }

  // テスト間で状態が混ざらないようにインスタンス配列を初期化
  static reset(): void {
    FakeMutationObserver.instances.length = 0;
  }
}

export { FakeMutationObserver };
