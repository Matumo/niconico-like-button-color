/**
 * ロガー機能
 */
import { config } from "@main/config/config";
import { setDefaultConfig, setLoggerConfig, getLogger } from "@matumo/ts-simple-logger";

// ログのプレフィックス書式とプレースホルダを初期化
setDefaultConfig({
  placeholders: { "%appName": config.appName, "%time": () => performance.now().toFixed(1) },
  prefixFormat: "[%appName] %loggerName (%time ms) %logLevel:",
});
// デバッグフラグに応じてロガーレベルを切り替え
setLoggerConfig("main", {
  level: config.shouldUseDebugLog ? "debug" : "info",
});

// mainロガーを取得
const log = getLogger("main");

// ブラウザ環境の未捕捉エラー処理を登録
const handleBrowserErrors = (): void => {
  // ブラウザ環境でのみグローバルエラーを監視
  if (typeof globalThis.addEventListener !== "function") {
    return;
  }
  globalThis.addEventListener("error", (event: ErrorEvent): void => {
    const detail = event.error ?? event.message;
    log.error("Unhandled error:", detail);
  });
  globalThis.addEventListener("unhandledrejection", (event: PromiseRejectionEvent): void => {
    log.error("Unhandled rejection:", event.reason);
  });
};
// ブラウザ向けエラーハンドラを有効化
handleBrowserErrors();

// Node環境のprocess型定義
declare const process:
  | {
      on: (
        event: "uncaughtException" | "unhandledRejection",
        listener: (reason: unknown) => void,
      ) => void;
    };
// Node環境の未捕捉エラー処理を登録
const handleNodeErrors = (): void => {
  // Node実行時のみprocessイベントを監視
  const hasProcess = "process" in globalThis;
  if (!hasProcess || typeof process.on !== 'function') {
    return;
  }
  process.on("uncaughtException", (error: unknown): void => {
    log.error("Uncaught exception:", error);
  });
  process.on("unhandledRejection", (reason: unknown): void => {
    log.error("Unhandled rejection:", reason);
  });
};
// Node向けエラーハンドラを有効化
handleNodeErrors();

// ロガーを公開
export { log };
export default log;
