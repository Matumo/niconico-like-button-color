/**
 * 必要なDOM要素を検出し各監視オブザーバーを接続
 */
import { config, selectors } from "@main/config/config";
import { startButtonCheckObserver } from "@main/observer/button";
import log from "@main/util/logger";

// 監視開始に必要なDOM要素
type RequiredElements = {
  container: Element;
  fullscreenTarget: Element;
};

// 監視の再初期化に備えて各オブザーバーと前回ボタンを保持
let currentFullscreenChangeObserver: MutationObserver | null = null;
let currentFindButtonObserver: MutationObserver | null = null;
let currentInitElementsObserver: MutationObserver | null = null;
let prevButtonElement: Element | null = null;

// いいねボタンを取得してボタン監視を開始する関数
const getButtonAndStartCheck = (): void => {
  // 同じDOMノードに対する二重初期化を避ける
  const button = document.querySelector(selectors.likeButton);
  if (!button || button === prevButtonElement) return;
  log.debug("Like button found.");

  // 新しい要素を記録
  prevButtonElement = button;

  // ボタンの監視を開始
  startButtonCheckObserver(button);
};

// フルスクリーン変更時にボタン要素が変わるので再評価する関数
const onFullscreenChange = (): void => {
  log.debug("Fullscreen change detected.");
  getButtonAndStartCheck();
};

// フルスクリーン変更監視を開始する関数
const startFullscreenChangeObserver = (fullscreenTarget: Element): void => {
  // 古いオブザーバーを停止
  if (currentFullscreenChangeObserver) {
    currentFullscreenChangeObserver.disconnect();
    currentFullscreenChangeObserver = null;
  }
  // 新しいオブザーバーを開始
  const observer = new MutationObserver(onFullscreenChange);
  observer.observe(fullscreenTarget, { childList: true, subtree: false });
  // 新しいオブザーバーを記録
  currentFullscreenChangeObserver = observer;
};

// ボタン探索監視を開始する関数
const startFindButtonObserver = (container: Element): void => {
  // 古いオブザーバーを停止
  if (currentFindButtonObserver) {
    currentFindButtonObserver.disconnect();
    currentFindButtonObserver = null;
  }
  // 新しいオブザーバーを開始
  const buttonObserver = new MutationObserver(getButtonAndStartCheck);
  buttonObserver.observe(container, { childList: true, subtree: false });
  // 新しいオブザーバーを記録
  currentFindButtonObserver = buttonObserver;

  // 初回実行
  getButtonAndStartCheck();
};

// 必要要素が揃った時点で次段監視を開始する関数
const startNextObservers = (elements: RequiredElements): void => {
  startFullscreenChangeObserver(elements.fullscreenTarget);
  startFindButtonObserver(elements.container);
};

// 監視に必要な要素を取得する関数
const getRequiredElements = (): RequiredElements | null => {
  // いいねボタンコンテナが見つからなければ待機継続
  const container = document.querySelector(selectors.likeButtonContainer);
  if (!container) return null;

  // フルスクリーン監視対象が見つからなければ待機継続
  const fullscreenTarget = document.querySelector(selectors.fullscreenChangeTarget);
  if (!fullscreenTarget) return null;

  // 次段監視に必要な要素が揃ったら返す
  return { container, fullscreenTarget };
};

// 必要要素の待機監視から次段監視へ移行する関数
const getButtonContainerAndStartObserver = (
  _: MutationRecord[] | null,
  observer: MutationObserver,
): void => {
  // 必要な要素を取得
  const elements = getRequiredElements();
  if (!elements) return;

  // 必要要素が揃ったら待機用オブザーバーを破棄
  observer.disconnect();
  currentInitElementsObserver = null;

  // 次段オブザーバーを開始
  startNextObservers(elements);
};

// コンテナ監視初期化を実行する関数
const init = (): void => {
  // 対象URL以外は処理しない
  if (!config.nicoVideoPageUrlPatternRegExp.test(globalThis.location.href)) {
    return;
  }

  // 古いオブザーバーを停止
  if (currentInitElementsObserver) {
    currentInitElementsObserver.disconnect();
    currentInitElementsObserver = null;
  }

  // 必要な要素を取得
  const elements = getRequiredElements();
  if (elements) {
    // 既に必要な要素があれば次段オブザーバーを開始
    startNextObservers(elements);
    return;
  }

  // まだ必要な要素が無い場合はbodyを監視して待機
  const observer = new MutationObserver(getButtonContainerAndStartObserver);
  observer.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
  });
  // 新しいオブザーバーを記録
  currentInitElementsObserver = observer;

  // 初回実行
  getButtonContainerAndStartObserver(null, observer);
};

// エクスポート
export { init };
