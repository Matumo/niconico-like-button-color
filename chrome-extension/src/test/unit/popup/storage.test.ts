import { beforeEach, describe, expect, it, vi } from "vitest";

describe("popup storage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("chrome storageから設定を読み込み、共有定義に従って正規化する", async () => {
    const get = vi.fn().mockResolvedValue({
      likeButtonColor: "#12ab34",
      customColor: "invalid",
    });

    vi.stubGlobal("chrome", {
      storage: {
        local: { get },
      },
    });

    const { readLikeButtonSettings } = await import("@main/popup/storage");

    await expect(readLikeButtonSettings()).resolves.toEqual({
      likeButtonColor: "#12AB34",
      customColor: "#1E90FF",
    });
    expect(get).toHaveBeenCalledWith({
      likeButtonColor: "#FF8FA8",
      customColor: "#1E90FF",
    });
  });

  it("色設定の書き込み時にpopup側で正規化して保存する", async () => {
    const set = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("chrome", {
      storage: {
        local: { set },
      },
    });

    const {
      writeCustomColor,
      writeLikeButtonColor,
    } = await import("@main/popup/storage");

    await writeLikeButtonColor("#abcdef");
    await writeCustomColor("invalid");

    expect(set).toHaveBeenNthCalledWith(1, { likeButtonColor: "#ABCDEF" });
    expect(set).toHaveBeenNthCalledWith(2, { customColor: "#1E90FF" });
  });
});
