/**
 * watch / shorts のDOM要素を検出してボタン監視を開始する
 *
 * watch:
 * 1. プレイヤーとボタンコンテナが取得できるまで待つ
 * 2. フルスクリーン変更とボタン差し替えを監視する
 *
 * shorts:
 * 1. active playlist要素が取得できるまで待つ
 * 2. 親を監視してactive変更やボタンmount/unmountを追従する
 */
import { config, selectors } from "@main/config/config";
import {
  resetLikeButtonObservers,
  startLikeButtonObserver,
} from "@main/observer/button";
import log from "@main/util/logger";

// 監視開始に必要なDOM要素
type RequiredWatchElements = {
  container: Element;
  fullscreenTarget: Element;
};

// 監視の再初期化に備えて各オブザーバーと前回ボタンを保持
let currentFullscreenChangeObserver: MutationObserver | null = null;
let currentFindButtonObserver: MutationObserver | null = null;
let currentInitElementsObserver: MutationObserver | null = null;
let currentShortsPlaylistObserver: MutationObserver | null = null;
let prevButtonElement: Element | null = null;

// watch/shortsのDOM探索に使うオブザーバーをすべて停止する関数
const disconnectDomObservers = (): void => {
  // 必要要素の待機監視を停止
  currentInitElementsObserver?.disconnect();
  currentInitElementsObserver = null;

  // watchのボタン探索監視を停止
  currentFindButtonObserver?.disconnect();
  currentFindButtonObserver = null;

  // watchのフルスクリーン変更監視を停止
  currentFullscreenChangeObserver?.disconnect();
  currentFullscreenChangeObserver = null;

  // shortsのplaylist監視を停止
  currentShortsPlaylistObserver?.disconnect();
  currentShortsPlaylistObserver = null;
};

// 新しいいいねボタンだけをボタン監視へ渡す関数
const startButtonObserverIfChanged = (button: Element | null): void => {
  // 同じDOMノードに対する二重初期化を避ける
  if (!button || button === prevButtonElement) return;
  log.debug("Like button found.");

  // 新しい要素を記録
  prevButtonElement = button;

  // ボタンの監視を開始
  startLikeButtonObserver(button);
};

// 広告やロード中などactiveなショート動画にボタンが無い場合に前回の監視を解除する関数
const clearButtonObserverIfNeeded = (): void => {
  // 初期表示からボタンが無い場合は解除対象も無い
  if (!prevButtonElement) return;

  // 前回ボタンの参照と監視を破棄
  prevButtonElement = null;
  resetLikeButtonObservers();
};

// ---- watch -----------------------------------------------------------------

// いいねボタンを取得してボタン監視を開始する関数
const getWatchButtonAndStartCheck = (): void => {
  startButtonObserverIfChanged(document.querySelector(selectors.likeButton));
};

// フルスクリーン変更時にボタン要素が変わるので再評価する関数
const onFullscreenChange = (): void => {
  log.debug("Fullscreen change detected.");
  getWatchButtonAndStartCheck();
};

// フルスクリーン変更監視を開始する関数
const startFullscreenChangeObserver = (fullscreenTarget: Element): void => {
  // 古いオブザーバーを停止
  currentFullscreenChangeObserver?.disconnect();

  // 新しいオブザーバーを開始して記録
  const observer = new MutationObserver(onFullscreenChange);
  observer.observe(fullscreenTarget, { childList: true, subtree: false });
  currentFullscreenChangeObserver = observer;
};

// ボタン探索監視を開始する関数
const startFindWatchButtonObserver = (container: Element): void => {
  // 古いオブザーバーを停止
  currentFindButtonObserver?.disconnect();

  // 新しいオブザーバーを開始して記録
  const observer = new MutationObserver(getWatchButtonAndStartCheck);
  observer.observe(container, { childList: true, subtree: false });
  currentFindButtonObserver = observer;

  // 初回実行
  getWatchButtonAndStartCheck();
};

// watchの監視に必要な要素を取得する関数
const getRequiredWatchElements = (): RequiredWatchElements | null => {
  // いいねボタンコンテナが見つからなければ待機継続
  const container = document.querySelector(selectors.likeButtonContainer);
  if (!container) return null;

  // フルスクリーン監視対象が見つからなければ待機継続
  const fullscreenTarget = document.querySelector(selectors.fullscreenChangeTarget);
  if (!fullscreenTarget) return null;

  // 次段監視に必要な要素が揃ったら返す
  return { container, fullscreenTarget };
};

// watchの必要要素が揃った時点で次段監視を開始する関数
const startWatchNextObservers = (elements: RequiredWatchElements): void => {
  startFullscreenChangeObserver(elements.fullscreenTarget);
  startFindWatchButtonObserver(elements.container);
};

// watchの必要要素の待機監視から次段監視へ移行する関数
const tryStartWatchObservers = (
  _: MutationRecord[] | null,
  observer: MutationObserver,
): void => {
  // 必要な要素を取得
  const elements = getRequiredWatchElements();
  if (!elements) return;

  // 必要要素が揃ったら待機用オブザーバーを破棄
  observer.disconnect();
  currentInitElementsObserver = null;

  // 次段オブザーバーを開始
  startWatchNextObservers(elements);
};

// watchのコンテナ監視初期化を実行する関数
const startWatchObservers = (): void => {
  // 必要な要素を取得
  const elements = getRequiredWatchElements();
  if (elements) {
    // 既に必要な要素があれば次段オブザーバーを開始
    startWatchNextObservers(elements);
    return;
  }

  // まだ必要な要素が無い場合はbodyを監視して待機
  const observer = new MutationObserver(tryStartWatchObservers);
  observer.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
  });

  // 新しいオブザーバーを記録
  currentInitElementsObserver = observer;

  // 初回実行
  tryStartWatchObservers(null, observer);
};

// ---- shorts ----------------------------------------------------------------

// 指定rootからアクティブなショート動画の要素を取得する関数
const getShortsActiveEntry = (root: ParentNode = document): Element | null =>
  root.querySelector(selectors.shortsActiveEntry);

// activeなショート動画配下のいいねボタンへ監視を同期する関数
const syncShortsActiveButton = (playlistRoot: Element): void => {
  // playlist内の最新のアクティブなショート動画と、その配下のshorts用いいねボタンを取得
  const activeEntry = getShortsActiveEntry(playlistRoot);
  const button = activeEntry?.querySelector(selectors.shortsLikeButton) ?? null;

  // 広告やロード中などlikeが無い場合は前回ボタンの監視を解除
  if (!button) {
    clearButtonObserverIfNeeded();
    return;
  }

  // 通常shortなら新しいactiveボタンへ監視を同期
  startButtonObserverIfChanged(button);
};

// activeなショート動画の親を監視して、short切替とボタンのmount/unmountを追従する関数
const startShortsPlaylistObserver = (activeEntry: Element): boolean => {
  // 親要素を取得できなければ監視開始できないので待機継続
  const playlistRoot = activeEntry.parentElement;
  if (!playlistRoot) return false;

  // 古いplaylist監視を停止
  currentShortsPlaylistObserver?.disconnect();

  // active属性と配下DOMの変化を監視して記録
  const observer = new MutationObserver(() => syncShortsActiveButton(playlistRoot));
  observer.observe(playlistRoot, {
    attributes: true,
    attributeFilter: ["data-playlist-state"],
    childList: true,
    subtree: true,
  });
  currentShortsPlaylistObserver = observer;

  // 初回実行
  syncShortsActiveButton(playlistRoot);
  return true;
};

// アクティブなショート動画の待機監視からplaylist監視へ移行する関数
const tryStartShortsObservers = (
  _: MutationRecord[] | null,
  observer: MutationObserver,
): void => {
  // activeなショート動画と、その親であるplaylist rootを取得できるまで待機継続
  const activeEntry = getShortsActiveEntry();
  if (!activeEntry || !startShortsPlaylistObserver(activeEntry)) return;

  // playlist監視を開始できたら待機用オブザーバーを破棄
  observer.disconnect();
  currentInitElementsObserver = null;
};

// shortsのコンテナ監視初期化を実行する関数
const startShortsObservers = (): void => {
  // アクティブなショート動画が既にあればplaylist監視を即時開始
  const activeEntry = getShortsActiveEntry();
  if (activeEntry && startShortsPlaylistObserver(activeEntry)) return;

  // 初期描画中はbodyを監視し、active属性とplaylist DOMの生成を待つ
  const observer = new MutationObserver(tryStartShortsObservers);
  observer.observe(document.body ?? document.documentElement, {
    attributes: true,
    attributeFilter: ["data-playlist-state"],
    childList: true,
    subtree: true,
  });

  // 新しいオブザーバーを記録
  currentInitElementsObserver = observer;

  // 初回実行
  tryStartShortsObservers(null, observer);
};

// ---- public API -------------------------------------------------------------

// コンテナ監視で扱う各オブザーバーを停止して状態を初期化する関数
const resetContainerObservers = (): void => {
  // DOM探索用の各オブザーバーを停止
  disconnectDomObservers();

  // 前回ボタンの状態を破棄
  prevButtonElement = null;

  // ボタンの監視を停止
  resetLikeButtonObservers();
};

// 現在のページ種別に応じてコンテナ監視を初期化する関数
const startContainerObservers = (): void => {
  const href = globalThis.location.href;
  const isWatchPage = config.nicoVideoPageUrlPatternRegExp.test(href);
  const isShortsPage = config.nicoShortsPageUrlPatternRegExp.test(href);

  // 対象URL以外は処理しない
  if (!isWatchPage && !isShortsPage) return;

  // 既存の監視を停止して状態を初期化
  disconnectDomObservers();

  // watch/shortsはDOM構造が異なるため、それぞれ専用の探索経路を開始
  if (isWatchPage) {
    startWatchObservers();
    return;
  }
  startShortsObservers();
};

// エクスポート
export { resetContainerObservers, startContainerObservers };
