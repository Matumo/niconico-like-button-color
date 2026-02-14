/**
 * SPA遷移を含むURL変更を監視
 *
 * 1. popstateとDOM監視でURL変更を検知するオブザーバーを開始する
 * 2. URL変更時にカスタムイベントを発火する
 * 3. main.tsがイベントを受け取り、container.tsのオブザーバーをリセットして再び開始する
 */
import { config } from "@main/config/config";
import log from "@main/util/logger";

// 直近URLと監視開始状態を保持
let lastUrl = globalThis.location.href;
let isStarted = false;
let urlChangeObserver: MutationObserver | null = null;

// URL変更を検知してカスタムイベントを発火する関数
const checkUrlChange = (): void => {
  try {
    // URLの取得
    const currentUrl = globalThis.location.href;
    if (currentUrl === lastUrl) return; // 前回と同じURLならスキップ
    lastUrl = currentUrl;
    log.debug("NicoVideo page URL changed:", currentUrl);

    // カスタムイベントを発火
    globalThis.dispatchEvent(new CustomEvent(config.nicoVideoPageUrlChangedEventName));
  } catch (error) {
    log.warn("Failed to check URL change:", error);
  }
};

// URL監視を開始する関数
const startPageUrlObserver = (): void => {
  if (isStarted) return; // 開始済みならスキップ
  isStarted = true;

  // 履歴遷移とDOM変化の両方でURL変更を拾う
  globalThis.addEventListener("popstate", checkUrlChange);

  urlChangeObserver = new MutationObserver(checkUrlChange);
  urlChangeObserver.observe(document.head ?? document.documentElement, {
    childList: true,
    attributes: true,
  });

  // 監視開始時点のURL差分も即時確認
  checkUrlChange();
};

// URL監視を停止する関数
const stopPageUrlObserver = (): void => {
  if (!isStarted) return; // 停止済みならスキップ
  isStarted = false;

  // 開始時に登録したリスナーとオブザーバーを解除
  globalThis.removeEventListener("popstate", checkUrlChange);
  urlChangeObserver?.disconnect();
  urlChangeObserver = null;
};

// エクスポート
export { startPageUrlObserver, stopPageUrlObserver };
