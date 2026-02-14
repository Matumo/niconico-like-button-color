/**
 * いいねボタンの状態監視とボタン色の同期機能
 */
import { storage } from "@main/config/storage";
import log from "@main/util/logger";

// data-element-paramsのパース結果
type LikeButtonParams = {
  current?: boolean;
};

// ボタン状態（pathとcurrent状態）
type ButtonState = {
  svgPath: SVGPathElement | null;
  currentStatus: boolean | null;
};

// 同時に複数監視しないよう最新の監視インスタンスを保持
let currentButtonCheckObserver: MutationObserver | null = null;

// ボタン監視オブザーバーを停止して状態を初期化する関数
const resetObservers = (): void => {
  currentButtonCheckObserver?.disconnect();
  currentButtonCheckObserver = null;
};

// いいね状態を取得する関数
const readCurrentStatus = (button: Element): boolean | null => {
  // ボタン状態はdataset.elementParamsにJSONで保持されている
  const raw = (button as HTMLElement).dataset.elementParams;
  if (!raw) return null;
  try {
    // current=trueのみ「いいね」として扱う
    const params = JSON.parse(raw) as LikeButtonParams;
    return params.current === true;
  } catch (error) {
    // 解析失敗時は処理を続けず監視ループを壊さない（nullを返して更新処理をスキップ）
    log.warn("Failed to parse data-element-params:", error);
    return null;
  }
};

// 現在のボタンの状態を取得する関数
const getButtonState = (button: Element): ButtonState => ({
  svgPath: button.querySelector<SVGPathElement>("svg path"),
  currentStatus: readCurrentStatus(button),
});

// 拡張機能によるfill属性の更新であることを判定する関数
const isSelfFillMutation = (
  mutation: MutationRecord,
  svgPath: SVGPathElement | null,
): boolean => {
  if (mutation.type !== "attributes") return false;
  return mutation.target === svgPath && mutation.attributeName === "fill";
};

// 拡張機能による属性更新以外が含まれていることを判定する関数
const hasNonSelfMutation = (
  mutations: MutationRecord[],
  svgPath: SVGPathElement | null,
): boolean => mutations.some((mutation) => !isSelfFillMutation(mutation, svgPath));

// 直近状態との差分があるかを判定する関数
const hasStateDiff = (
  currentState: ButtonState,
  previousState: ButtonState,
): boolean =>
  currentState.svgPath !== previousState.svgPath ||
  currentState.currentStatus !== previousState.currentStatus;

// ボタン監視オブザーバーを差し替えて監視を開始する関数
const replaceButtonCheckObserver = (button: Element, observer: MutationObserver): void => {
  // 古いオブザーバーを停止
  currentButtonCheckObserver?.disconnect();
  currentButtonCheckObserver = null;
  // 新しいオブザーバーを開始
  observer.observe(button, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  // 新しいオブザーバーを記録
  currentButtonCheckObserver = observer;
};

// いいね状態に応じて色を更新して直近状態を記録する関数
const updateSvgColor = (currentState: ButtonState, previousState: ButtonState): void => {
  const { svgPath, currentStatus } = currentState;
  if (!svgPath || currentStatus === null) {
    log.debug("Skipping update. svgPath or currentStatus is missing.");
    return;
  }

  // いいね状態に応じてfill属性を設定または除去
  if (currentStatus) {
    svgPath.setAttribute("fill", storage.getLikeButtonColor());
  } else {
    svgPath.removeAttribute("fill");
  }

  // 状態更新（次回の差分判定に利用）
  previousState.svgPath = svgPath;
  previousState.currentStatus = currentStatus;

  log.debug("Like button color updated.", {
    currentStatus,
    fill: svgPath.getAttribute("fill"),
  });
};

// いいねボタン監視オブザーバーを開始する関数
const startButtonCheckObserver = (button: Element): void => {
  // クリック後の再描画で要素が置き換わるため直近状態を保持
  const previousState: ButtonState = {
    svgPath: null,
    currentStatus: null,
  };

  // いいねボタンの属性変化を監視して、必要なら色を更新するオブザーバー
  const attributeObserver = new MutationObserver((mutations) => {
    // 拡張機能以外による属性の変更がない場合はスキップ
    const hasNonSelfChange = hasNonSelfMutation(mutations, previousState.svgPath);
    if (!hasNonSelfChange) return;
    // 現在状態を取得して差分判定と更新に使う
    const currentState = getButtonState(button);
    // 直近状態との差分がない場合はスキップ
    const hasCurrentStateDiff = hasStateDiff(currentState, previousState);
    if (!hasCurrentStateDiff) return;
    // いいねボタンの色を更新
    updateSvgColor(currentState, previousState);
  });

  // 現在のボタンを監視対象としてオブザーバーを差し替え
  replaceButtonCheckObserver(button, attributeObserver);

  // 監視開始直後に見た目を同期
  const currentState = getButtonState(button);
  updateSvgColor(currentState, previousState);
};

// エクスポート
export { startButtonCheckObserver, resetObservers };
