/**
 * 拡張機能のエントリーポイント
 */
import { config } from "@main/config/config";
import log from "@main/util/logger";
import { storage } from "@main/config/storage";
import { init, resetObservers } from "@main/observer/container";
import { startPageUrlObserver } from "@main/observer/page";

// エントリーポイントの関数
const bootstrap = async (): Promise<void> => {
  // ブラウザ設定の読み込み
  await storage.fetchLikeButtonColor();

  // URL変更イベントを受けたら画面状態を初期化するイベントを登録
  globalThis.addEventListener(config.nicoVideoPageUrlChangedEventName, () => {
    log.debug("Change nico video page URL event.");
    resetObservers();
    init();
  });

  // URL監視を有効化し初回も即時に初期化を実行
  startPageUrlObserver();
  init();
};

// 処理開始
void bootstrap();
