/**
 * like ボタン色設定の共通定義と純粋関数
 */
const likeButtonColorStorageKey = "likeButtonColor";
const customColorStorageKey = "customColor";

const defaultLikeButtonColor = "#FF8FA8";
const defaultCustomColor = "#1E90FF";

type LikeButtonSettings = {
  likeButtonColor: string;
  customColor: string;
};

type PartialLikeButtonSettings = {
  likeButtonColor?: unknown;
  customColor?: unknown;
};

const normalizedHexColorPattern = /^#[0-9A-F]{6}$/;

const normalizeHexColor = (value: unknown, fallbackColor: string): string => {
  if (typeof value !== "string") {
    return fallbackColor;
  }

  const normalizedColor = value.toUpperCase();
  return normalizedHexColorPattern.test(normalizedColor) ? normalizedColor : fallbackColor;
};

const normalizeLikeButtonColor = (value: unknown): string => {
  return normalizeHexColor(value, defaultLikeButtonColor);
};

const normalizeCustomColor = (value: unknown): string => {
  return normalizeHexColor(value, defaultCustomColor);
};

const normalizeLikeButtonSettings = (settings: PartialLikeButtonSettings): LikeButtonSettings => {
  return {
    likeButtonColor: normalizeLikeButtonColor(settings.likeButtonColor),
    customColor: normalizeCustomColor(settings.customColor),
  };
};

export {
  customColorStorageKey,
  defaultCustomColor,
  defaultLikeButtonColor,
  likeButtonColorStorageKey,
  normalizeCustomColor,
  normalizeLikeButtonColor,
  normalizeLikeButtonSettings,
};
export type { LikeButtonSettings };
