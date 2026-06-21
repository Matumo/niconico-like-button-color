import {
  readLikeButtonSettings,
  writeCustomColor,
  writeLikeButtonColor,
} from "@main/popup/storage";

type ColorChoice = {
  color: string;
  label: string;
};

type PopupElements = {
  title: HTMLElement;
  selectColors: HTMLDivElement;
  save: HTMLButtonElement;
  message: HTMLDivElement;
};

const heartIconPath =
  "M11.52 20.87C11.13 20.65 2 15.31 2 8.8 " +
  "2 6 3.91 3 7.45 3a4.6 4.6 0 0 1 4.3 2.96c.08.2.43.2.5 0 " +
  "A4.7 4.7 0 0 1 16.54 3C20.09 3 22 6 22 8.8c0 6.51-9.13 11.85 " +
  "-9.52 12.07a1 1 0 0 1-.96 0";
const presetColors: ColorChoice[] = [
  { color: "#FFC0CB", label: "Pink 1" },
  { color: "#FF8FA8", label: "Pink 2" },
  { color: "#FF69B4", label: "Pink 3" },
  { color: "#FF1493", label: "Pink 4" },
];

const isPresetColor = (color: string): boolean => {
  return presetColors.some((presetColor) => presetColor.color === color);
};

const createHeartIcon = (fillColor: string): SVGSVGElement => {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  const path = document.createElementNS(svgNamespace, "path");

  svg.setAttribute("xmlns", svgNamespace);
  svg.setAttribute("width", "128");
  svg.setAttribute("height", "128");
  svg.setAttribute("viewBox", "0 0 24 24");
  path.setAttribute("fill", fillColor);
  path.setAttribute("d", heartIconPath);
  svg.appendChild(path);

  return svg;
};

const getRequiredElement = <T extends Element>(
  root: Document,
  selector: string,
  elementName: string,
): T => {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${elementName}`);
  }
  return element;
};

const getPopupElements = (root: Document): PopupElements => {
  return {
    title: getRequiredElement<HTMLElement>(root, "#title", "title"),
    selectColors: getRequiredElement<HTMLDivElement>(root, "#selectColors", "selectColors"),
    save: getRequiredElement<HTMLButtonElement>(root, "#save", "save"),
    message: getRequiredElement<HTMLDivElement>(root, "#message", "message"),
  };
};

const replaceIcon = (container: HTMLElement, color: string): void => {
  container.replaceChildren(createHeartIcon(color));
};

const createPresetOption = (
  root: Document,
  option: ColorChoice,
  selectedColorRef: { current: string },
  message: HTMLDivElement,
): HTMLLabelElement => {
  const wrapper = root.createElement("label");
  const radioButton = root.createElement("input");
  const icon = root.createElement("span");
  const labelText = root.createElement("span");

  wrapper.classList.add("selectColorsItem");
  radioButton.type = "radio";
  radioButton.name = "presetColor";
  radioButton.value = option.color;
  radioButton.checked = option.color === selectedColorRef.current;
  replaceIcon(icon, option.color);
  labelText.textContent = `${option.label} (${option.color})`;

  radioButton.addEventListener("change", () => {
    selectedColorRef.current = option.color;
    message.textContent = "";
  });

  wrapper.append(radioButton, icon, labelText);
  return wrapper;
};

const createCustomOption = (
  root: Document,
  initialCustomColor: string,
  selectedColorRef: { current: string },
  message: HTMLDivElement,
): HTMLLabelElement => {
  const wrapper = root.createElement("label");
  const radioButton = root.createElement("input");
  const icon = root.createElement("span");
  const labelText = root.createElement("span");
  const colorPicker = root.createElement("input");

  wrapper.classList.add("selectColorsItem");
  radioButton.type = "radio";
  radioButton.name = "presetColor";
  radioButton.value = initialCustomColor;
  radioButton.checked = !isPresetColor(selectedColorRef.current);
  replaceIcon(icon, initialCustomColor);
  labelText.textContent = `Custom (${initialCustomColor})`;
  colorPicker.type = "color";
  colorPicker.value = initialCustomColor;

  radioButton.addEventListener("change", () => {
    selectedColorRef.current = radioButton.value;
    message.textContent = "";
  });
  colorPicker.addEventListener("input", async () => {
    const nextColor = colorPicker.value.toUpperCase();

    radioButton.value = nextColor;
    radioButton.checked = true;
    selectedColorRef.current = nextColor;
    replaceIcon(icon, nextColor);
    labelText.textContent = `Custom (${nextColor})`;
    message.textContent = "";
    syncSelectedState(root);
    await writeCustomColor(nextColor);
  });

  wrapper.append(radioButton, icon, labelText, colorPicker);
  return wrapper;
};

const syncSelectedState = (root: Document): void => {
  root.querySelectorAll<HTMLLabelElement>(".selectColorsItem").forEach((wrapper) => {
    const radioButton = wrapper.querySelector<HTMLInputElement>('input[name="presetColor"]');
    wrapper.classList.toggle("selected", radioButton?.checked === true);
  });
};

const renderColorOptions = (
  root: Document,
  selectColors: HTMLDivElement,
  selectedColor: string,
  customColor: string,
  message: HTMLDivElement,
): { selectedColorRef: { current: string } } => {
  const selectedColorRef = { current: selectedColor };
  const resolvedCustomColor = isPresetColor(selectedColor) ? customColor : selectedColor;
  const optionWrappers = presetColors.map((option) => {
    return createPresetOption(root, option, selectedColorRef, message);
  });
  const customOption = createCustomOption(root, resolvedCustomColor, selectedColorRef, message);

  selectColors.replaceChildren(...optionWrappers, customOption);
  selectColors.querySelectorAll<HTMLInputElement>('input[name="presetColor"]').forEach((radioButton) => {
    radioButton.addEventListener("change", () => {
      syncSelectedState(root);
    });
  });
  syncSelectedState(root);

  return { selectedColorRef };
};

const bootstrapOptionsPage = async (root: Document = document): Promise<void> => {
  const elements = getPopupElements(root);
  const extensionName = chrome.i18n.getMessage("extensionName");
  const saveButtonLabel = chrome.i18n.getMessage("saveButton");
  const { likeButtonColor, customColor } = await readLikeButtonSettings();
  const { selectedColorRef } = renderColorOptions(
    root,
    elements.selectColors,
    likeButtonColor,
    customColor,
    elements.message,
  );

  root.title = extensionName;
  elements.selectColors.classList.add("selectColors");
  elements.title.textContent = extensionName;
  elements.save.textContent = saveButtonLabel;
  elements.save.addEventListener("click", async () => {
    await writeLikeButtonColor(selectedColorRef.current);
    elements.message.textContent = chrome.i18n.getMessage("savedMessage");
    syncSelectedState(root);
  });
};

export { bootstrapOptionsPage };
