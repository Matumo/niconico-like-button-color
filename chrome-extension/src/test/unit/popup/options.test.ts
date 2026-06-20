// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
};

const renderPopupDocument = (includeSaveButton = true): Document => {
  document.title = "-";
  document.body.innerHTML = `
    <h1 id="title">-</h1>
    <div id="selectColors"></div>
    ${includeSaveButton ? '<button id="save" type="button"></button>' : ""}
    <div id="message"></div>
  `;
  return document;
};

const defaultMessages = {
  extensionName: "Niconico Like Button Color",
  saveButton: "Save",
  savedMessage: "Saved",
};

const stubChromeI18n = (messages: Partial<typeof defaultMessages> = {}) => {
  const resolvedMessages = {
    ...defaultMessages,
    ...messages,
  };
  const getMessage = vi.fn((key: string) => {
    if (key in resolvedMessages) {
      return resolvedMessages[key as keyof typeof resolvedMessages];
    }
    return "";
  });

  vi.stubGlobal("chrome", {
    i18n: { getMessage },
  });

  return { getMessage };
};

const loadPopupModule = async (settings: { likeButtonColor: string; customColor: string }) => {
  const readLikeButtonSettings = vi.fn().mockResolvedValue(settings);
  const writeLikeButtonColor = vi.fn().mockResolvedValue(undefined);
  const writeCustomColor = vi.fn().mockResolvedValue(undefined);

  vi.doMock("@main/popup/storage", () => ({
    readLikeButtonSettings,
    writeCustomColor,
    writeLikeButtonColor,
  }));

  const { bootstrapOptionsPage } = await import("@main/popup/options");

  return {
    bootstrapOptionsPage,
    readLikeButtonSettings,
    writeCustomColor,
    writeLikeButtonColor,
  };
};

describe("popup options", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.title = "";
  });

  it("必須DOM要素が不足している場合は明示的に失敗する", async () => {
    renderPopupDocument(false);

    const { bootstrapOptionsPage } = await import("@main/popup/options");

    await expect(bootstrapOptionsPage(document)).rejects.toThrow("Missing required element: save");
  });

  it("初期化時にプリセット色を描画し、文言と選択状態を反映する", async () => {
    const popupDocument = renderPopupDocument();
    const { getMessage } = stubChromeI18n();
    const { bootstrapOptionsPage, readLikeButtonSettings } = await loadPopupModule({
      likeButtonColor: "#FF8FA8",
      customColor: "#1E90FF",
    });

    await bootstrapOptionsPage(popupDocument);

    expect(readLikeButtonSettings).toHaveBeenCalledTimes(1);
    expect(getMessage).toHaveBeenCalledWith("extensionName");
    expect(getMessage).toHaveBeenCalledWith("saveButton");
    expect(popupDocument.title).toBe("Niconico Like Button Color");
    expect(popupDocument.querySelector("#title")?.textContent).toBe("Niconico Like Button Color");
    expect(popupDocument.querySelector("#save")?.textContent).toBe("Save");
    expect(popupDocument.querySelector("#selectColors")?.classList.contains("selectColors")).toBe(true);
    expect(popupDocument.querySelectorAll(".selectColorsItem")).toHaveLength(5);

    const selectedInput = popupDocument.querySelector<HTMLInputElement>('input[name="presetColor"]:checked');
    expect(selectedInput?.value).toBe("#FF8FA8");
    expect(selectedInput?.closest(".selectColorsItem")?.classList.contains("selected")).toBe(true);
  });

  it("カスタム色の保存完了前に保存しても最新の色でlikeButtonColorを保存する", async () => {
    const popupDocument = renderPopupDocument();
    stubChromeI18n();
    let resolveWriteCustomColor: (() => void) | undefined;
    const pendingWriteCustomColor = new Promise<void>((resolve) => {
      resolveWriteCustomColor = resolve;
    });
    const { bootstrapOptionsPage, writeCustomColor, writeLikeButtonColor } = await loadPopupModule({
      likeButtonColor: "#FF8FA8",
      customColor: "#1E90FF",
    });
    writeCustomColor.mockImplementation(() => pendingWriteCustomColor);

    await bootstrapOptionsPage(popupDocument);

    const colorPicker = popupDocument.querySelector<HTMLInputElement>('input[type="color"]');
    const saveButton = popupDocument.querySelector<HTMLButtonElement>("#save");

    if (!colorPicker || !saveButton) {
      throw new Error("Failed to find rendered popup controls.");
    }

    colorPicker.value = "#abcdef";
    colorPicker.dispatchEvent(new Event("input", { bubbles: true }));
    saveButton.click();
    await flushPromises();

    expect(writeLikeButtonColor).toHaveBeenCalledWith("#ABCDEF");

    resolveWriteCustomColor?.();
    await flushPromises();
  });

  it("保存済みの色がプリセット外ならカスタム色として表示して選択する", async () => {
    const popupDocument = renderPopupDocument();
    stubChromeI18n();
    const { bootstrapOptionsPage } = await loadPopupModule({
      likeButtonColor: "#12AB34",
      customColor: "#1E90FF",
    });

    await bootstrapOptionsPage(popupDocument);

    const colorPicker = popupDocument.querySelector<HTMLInputElement>('input[type="color"]');
    const customWrapper = colorPicker?.closest(".selectColorsItem");
    const customRadioButton = customWrapper?.querySelector<HTMLInputElement>('input[name="presetColor"]');

    expect(colorPicker?.value.toUpperCase()).toBe("#12AB34");
    expect(customRadioButton?.value).toBe("#12AB34");
    expect(customRadioButton?.checked).toBe(true);
    expect(customWrapper?.classList.contains("selected")).toBe(true);
    expect(customWrapper?.textContent).toContain("Custom (#12AB34)");
  });

  it("カラーピッカー変更でcustomColor保存と表示更新を行う", async () => {
    const popupDocument = renderPopupDocument();
    stubChromeI18n();
    const { bootstrapOptionsPage, writeCustomColor } = await loadPopupModule({
      likeButtonColor: "#FF8FA8",
      customColor: "#1E90FF",
    });

    await bootstrapOptionsPage(popupDocument);

    const message = popupDocument.querySelector<HTMLDivElement>("#message");
    const colorPicker = popupDocument.querySelector<HTMLInputElement>('input[type="color"]');
    const customWrapper = colorPicker?.closest(".selectColorsItem");
    const customRadioButton = customWrapper?.querySelector<HTMLInputElement>('input[name="presetColor"]');

    if (!message || !colorPicker || !customWrapper || !customRadioButton) {
      throw new Error("Failed to find rendered custom option.");
    }

    message.textContent = "Saved";
    colorPicker.value = "#abcdef";
    colorPicker.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    expect(writeCustomColor).toHaveBeenCalledWith("#ABCDEF");
    expect(customRadioButton.value).toBe("#ABCDEF");
    expect(customRadioButton.checked).toBe(true);
    expect(customWrapper.classList.contains("selected")).toBe(true);
    expect(customWrapper.textContent).toContain("Custom (#ABCDEF)");
    expect(message.textContent).toBe("");
  });

  it("ラジオ選択と保存クリックでlikeButtonColorを保存する", async () => {
    const popupDocument = renderPopupDocument();
    const { getMessage } = stubChromeI18n();
    const { bootstrapOptionsPage, writeLikeButtonColor } = await loadPopupModule({
      likeButtonColor: "#FF8FA8",
      customColor: "#1E90FF",
    });

    await bootstrapOptionsPage(popupDocument);

    const message = popupDocument.querySelector<HTMLDivElement>("#message");
    const presetRadioButton = popupDocument.querySelector<HTMLInputElement>('input[name="presetColor"][value="#FF69B4"]');
    const colorPicker = popupDocument.querySelector<HTMLInputElement>('input[type="color"]');
    const customRadioButton = colorPicker?.closest(".selectColorsItem")?.querySelector<HTMLInputElement>(
      'input[name="presetColor"]',
    );
    const saveButton = popupDocument.querySelector<HTMLButtonElement>("#save");

    if (!message || !presetRadioButton || !customRadioButton || !saveButton) {
      throw new Error("Failed to find rendered popup controls.");
    }

    message.textContent = "Before";
    presetRadioButton.checked = true;
    presetRadioButton.dispatchEvent(new Event("change", { bubbles: true }));
    expect(message.textContent).toBe("");
    expect(presetRadioButton.closest(".selectColorsItem")?.classList.contains("selected")).toBe(true);

    message.textContent = "Before";
    customRadioButton.checked = true;
    customRadioButton.dispatchEvent(new Event("change", { bubbles: true }));
    saveButton.click();
    await flushPromises();

    expect(writeLikeButtonColor).toHaveBeenCalledWith("#1E90FF");
    expect(getMessage).toHaveBeenCalledWith("savedMessage");
    expect(message.textContent).toBe("Saved");
    expect(customRadioButton.closest(".selectColorsItem")?.classList.contains("selected")).toBe(true);
  });
});
