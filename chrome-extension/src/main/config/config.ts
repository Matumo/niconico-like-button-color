/**
 * アプリ全体で使う設定値とDOMセレクタ定義
 */
import { debugMode } from "@main/config/debug";

const appName = "niconico-like-button-color";
const prefixId = "com-matumo-dev-niconico-like";
const nicoVideoPageUrlChangedEventName = `${prefixId}-nicoVideoPageUrlChanged`;
const shouldUseDebugLog = debugMode;

// 動画再生ページのURLパターン（正規表現）
const nicoVideoPageUrlPatternRegExp = new RegExp("^https://www\\.nicovideo\\.jp/watch/.+$");
// ショート動画ページのURLパターン（正規表現）
const nicoShortsPageUrlPatternRegExp = new RegExp("^https://www\\.nicovideo\\.jp/shorts/.+$");

const likeButton = '[data-element-name="like"]';
const playerPresenterContainer = String.raw`div.grid-area_\[player\] > div.PlayerPresenter`;
const likeButtonContainer = `${playerPresenterContainer} > div:has(${likeButton})`;
const fullscreenChangeTarget = playerPresenterContainer;
// アクティブなショート動画（standbyにも同種要素が存在するのでactiveで絞る）
const shortsActiveEntry = '[data-playlist-type="shorts"][data-playlist-state="active"]';
// ショート動画のいいねボタン
const shortsLikeButton = '[data-element-page="shorts"][data-element-name="like"]';

// 設定値
const config = {
  appName,
  prefixId,
  nicoVideoPageUrlChangedEventName,
  nicoVideoPageUrlPatternRegExp,
  nicoShortsPageUrlPatternRegExp,
  shouldUseDebugLog,
  debugMode,
} as const;

// セレクタ定義
const selectors = {
  likeButton,
  likeButtonContainer,
  fullscreenChangeTarget,
  shortsActiveEntry,
  shortsLikeButton,
} as const;

// エクスポート
export { config, selectors };
