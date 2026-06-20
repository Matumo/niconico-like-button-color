import {
  customColorStorageKey,
  defaultCustomColor,
  defaultLikeButtonColor,
  likeButtonColorStorageKey,
  normalizeCustomColor,
  normalizeLikeButtonColor,
  normalizeLikeButtonSettings,
} from "@main/shared/like-button-settings";
import type { LikeButtonSettings } from "@main/shared/like-button-settings";

const readLikeButtonSettings = async (): Promise<LikeButtonSettings> => {
  const result = await chrome.storage.local.get({
    [likeButtonColorStorageKey]: defaultLikeButtonColor,
    [customColorStorageKey]: defaultCustomColor,
  });

  return normalizeLikeButtonSettings({
    likeButtonColor: result.likeButtonColor,
    customColor: result.customColor,
  });
};

const writeLikeButtonColor = async (color: string): Promise<void> => {
  await chrome.storage.local.set({
    [likeButtonColorStorageKey]: normalizeLikeButtonColor(color),
  });
};

const writeCustomColor = async (color: string): Promise<void> => {
  await chrome.storage.local.set({
    [customColorStorageKey]: normalizeCustomColor(color),
  });
};

export {
  readLikeButtonSettings,
  writeCustomColor,
  writeLikeButtonColor,
};
