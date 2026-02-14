/**
 * アプリ全体で使う設定値とDOMセレクタ定義
 */
import { debugMode } from "@main/config/debug";

const appName = "niconico-like-button-color";
const prefixId = "com-matumo-dev-niconico-like";
const nicoVideoPageUrlChangedEventName = `${prefixId}-nicoVideoPageUrlChanged`;
const nicoVideoPageUrlPatternRegExp = /^https:\/\/www\.nicovideo\.jp\/watch\/.+$/;
const shouldUseDebugLog = debugMode;

const likeButton = '[data-element-name="like"]';
const playerPresenterContainer = String.raw`div.grid-area_\[player\] > div.PlayerPresenter`;
const likeButtonContainer = `${playerPresenterContainer} > div:has(${likeButton})`;
const fullscreenChangeTarget = playerPresenterContainer;

// 設定値
const config = {
  appName,
  prefixId,
  nicoVideoPageUrlChangedEventName,
  nicoVideoPageUrlPatternRegExp,
  shouldUseDebugLog,
  debugMode,
} as const;

// セレクタ定義
const selectors = {
  likeButton,
  likeButtonContainer,
  fullscreenChangeTarget,
} as const;

// エクスポート
export { config, selectors };
