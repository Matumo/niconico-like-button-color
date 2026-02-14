import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ロガー", () => {
  beforeEach(() => {
    // モジュールとモックをリセット
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ロガー初期化時にブラウザとNodeのエラーハンドラを登録する", async () => {
    // ロガー設定APIとロガー本体のモックを用意
    const setDefaultConfig = vi.fn();
    const setLoggerConfig = vi.fn();
    const logger = {
      error: vi.fn(),
    };
    const getLogger = vi.fn(() => logger);
    // 登録されたグローバルハンドラを後から実行できるよう保持
    const browserListeners: Record<string, (event: unknown) => void> = {};
    const processListeners: Record<string, (reason: unknown) => void> = {};
    const processOn = vi.fn((eventName: string, listener: (reason: unknown) => void) => {
      processListeners[eventName] = listener;
    });
    // テスト対象が参照する依存モジュールを差し替え
    vi.doMock("@main/config/config", () => ({
      config: {
        appName: "test-app",
        shouldUseDebugLog: true,
      },
    }));
    vi.doMock("@matumo/ts-simple-logger", () => ({
      setDefaultConfig,
      setLoggerConfig,
      getLogger,
    }));
    // ブラウザ/Node相当のグローバルAPIをモック
    vi.stubGlobal(
      "addEventListener",
      vi.fn((eventName: string, listener: (event: unknown) => void) => {
        browserListeners[eventName] = listener;
      }),
    );
    vi.stubGlobal("process", { on: processOn });
    vi.stubGlobal("performance", { now: vi.fn(() => 123.45) });

    // テスト対象をインポート
    const loggerModule = await import("@main/util/logger");

    // 初期設定が期待通り反映されていることを検証
    expect(loggerModule.default).toBe(loggerModule.log);
    expect(getLogger).toHaveBeenCalledWith("main");
    expect(setDefaultConfig).toHaveBeenCalledTimes(1);
    expect(setLoggerConfig).toHaveBeenCalledWith("main", { level: "debug" });

    // setDefaultConfigに渡された設定内容を取り出して検証
    const defaultConfigArg = setDefaultConfig.mock.calls[0]?.[0] as {
      placeholders: Record<string, string | (() => string)>;
      prefixFormat: string;
    };
    // プレフィックス書式とプレースホルダーが期待通り構成されていることを確認
    expect(defaultConfigArg.prefixFormat).toContain("%time");
    expect(defaultConfigArg.placeholders["%appName"]).toBe("test-app");
    expect((defaultConfigArg.placeholders["%time"] as () => string)()).toBe("123.5");

    // 登録済みハンドラを直接呼んでエラーログ出力を確認
    browserListeners.error?.({ error: new Error("boom"), message: "ignored" });
    browserListeners.error?.({ error: undefined, message: "fallback-message" });
    browserListeners.unhandledrejection?.({ reason: "rejected" });

    // Node側ハンドラも呼び出して同様にログ処理されることを確認
    processListeners.uncaughtException?.("uncaught");
    processListeners.unhandledRejection?.("node-rejection");

    // 各イベント種別に対応するエラーメッセージで出力されることを検証
    expect(logger.error).toHaveBeenCalledWith("Unhandled error:", expect.any(Error));
    expect(logger.error).toHaveBeenCalledWith("Unhandled error:", "fallback-message");
    expect(logger.error).toHaveBeenCalledWith("Unhandled rejection:", "rejected");
    expect(logger.error).toHaveBeenCalledWith("Uncaught exception:", "uncaught");
    expect(logger.error).toHaveBeenCalledWith("Unhandled rejection:", "node-rejection");
  });

  it("グローバルAPIが無効な場合はハンドラ登録をスキップする", async () => {
    // ロガー設定APIの呼び出し確認用モックを準備
    const setDefaultConfig = vi.fn();
    const setLoggerConfig = vi.fn();
    const getLogger = vi.fn(() => ({ error: vi.fn() }));

    // 初期化時に参照される設定とロガー実装を差し替え
    vi.doMock("@main/config/config", () => ({
      config: {
        appName: "test-app",
        shouldUseDebugLog: false,
      },
    }));
    vi.doMock("@matumo/ts-simple-logger", () => ({
      setDefaultConfig,
      setLoggerConfig,
      getLogger,
    }));

    // グローバルAPIが未定義の実行環境を再現
    vi.stubGlobal("addEventListener", undefined);
    vi.stubGlobal("process", { on: undefined });

    // import時の初期化を実行
    await import("@main/util/logger");

    // ハンドラ登録はスキップされても設定反映は行われることを検証
    expect(setDefaultConfig).toHaveBeenCalledTimes(1);
    expect(setLoggerConfig).toHaveBeenCalledWith("main", { level: "info" });
  });
});
