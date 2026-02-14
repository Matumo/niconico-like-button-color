/**
 * ブラウザに保存された設定の取得・参照機能
 */
import log from "@main/util/logger";

// デフォルト色
const defaultLikeButtonColor = "#FF8FA8";
// 現在の設定値（メモリキャッシュ）
let currentLikeButtonColor = defaultLikeButtonColor;

// ブラウザから色設定を取得して現在値を更新する関数
const fetchLikeButtonColor = async (): Promise<string> => {
  const result = await chrome.storage.local.get({ likeButtonColor: defaultLikeButtonColor });
  currentLikeButtonColor = typeof result.likeButtonColor === "string" ?
    result.likeButtonColor : defaultLikeButtonColor; // 設定値がない場合はデフォルト値を使用
  log.debug("likeButtonColor loaded:", currentLikeButtonColor);
  return currentLikeButtonColor;
};

// 現在の設定値を返す関数
const getLikeButtonColor = (): string => currentLikeButtonColor;

// ストレージ関連の公開API
const storage = {
  getLikeButtonColor,
  fetchLikeButtonColor,
} as const;

// エクスポート
export { storage };
