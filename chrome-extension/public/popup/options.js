document.addEventListener('DOMContentLoaded', async () => {
  // タイトルを設定
  {
    const title = chrome.i18n.getMessage("extensionName");
    document.title = title;
    document.getElementById('title').textContent = title;
  }

  // 保存ボタンを設定
  {
    const saveButton = document.getElementById('save');
    const saveLabel = chrome.i18n.getMessage("saveButton") || "Save";
    saveButton.textContent = saveLabel;
  }

  // svg生成関数
  function createSVGIcon(fillColor, strokeColor = null, strokeWidth = 1.5) {
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('width', '128');
    svg.setAttribute('height', '128');
    svg.setAttribute('viewBox', '0 0 24 24');

    // 縁取りがある場合のパス
    if (strokeColor) {
      const outlinedPath = document.createElementNS(SVG_NS, 'path');
      outlinedPath.setAttribute('fill', strokeColor);
      outlinedPath.setAttribute('stroke', strokeColor);
      outlinedPath.setAttribute('stroke-width', String(strokeWidth));
      outlinedPath.setAttribute(
        'd',
        'M11.52 20.87C11.13 20.65 2 15.31 2 8.8 ' +
          '2 6 3.91 3 7.45 3a4.6 4.6 0 0 1 4.3 2.96c.08.2.43.2.5 0 ' +
          'A4.7 4.7 0 0 1 16.54 3C20.09 3 22 6 22 8.8c0 6.51-9.13 11.85 ' +
          '-9.52 12.07a1 1 0 0 1-.96 0'
      );
      svg.appendChild(outlinedPath);
    }

    // 塗りつぶしのみのパス
    const basePath = document.createElementNS(SVG_NS, 'path');
    basePath.setAttribute('fill', fillColor);
    basePath.setAttribute(
      'd',
      'M11.52 20.87C11.13 20.65 2 15.31 2 8.8 ' +
        '2 6 3.91 3 7.45 3a4.6 4.6 0 0 1 4.3 2.96c.08.2.43.2.5 0 ' +
        'A4.7 4.7 0 0 1 16.54 3C20.09 3 22 6 22 8.8c0 6.51-9.13 11.85 ' +
        '-9.52 12.07a1 1 0 0 1-.96 0'
    );
    svg.appendChild(basePath);

    return svg;
  }

  // プリセットカラー
  const presetColors = [
    { color: "#FFC0CB", label: "Pink 1" },
    { color: "#FF8FA8", label: "Pink 2" },
    { color: "#FF69B4", label: "Pink 3" },
    { color: "#FF1493", label: "Pink 4" },
  ];

  // 色の選択エリア
  const presetColorsContainer = document.getElementById('selectColors');
  const saveButton = document.getElementById('save');
  const messageDiv = document.getElementById('message');

  // ストレージから保存されている色を読み込み
  const { likeButtonColor } = await chrome.storage.local.get({ likeButtonColor: "#FF8FA8" });
  const { customColor } = await chrome.storage.local.get({ customColor: "#1E90FF" });

  console.debug("likeButtonColor:", likeButtonColor);
  console.debug("customColor:", customColor);

  console.debug(await chrome.storage.local.get("likeButtonColor"));
  console.debug(await chrome.storage.local.get("customColor"));

  // ラジオボタンの選択が変更されたときに実行する関数のリスト
  let updateRadioButtonFunctionList = [];

  // プリセットカラーのラジオボタンを生成
  presetColors.forEach(({ color, label }) => {
    const wrapper = document.createElement('label');
    wrapper.classList.add('selectColorsItem');

    const radioButton = document.createElement('input');
    radioButton.type = 'radio';
    radioButton.name = 'presetColor';
    radioButton.value = color;
    radioButton.checked = (color === likeButtonColor);

    updateRadioButtonFunctionList.push(() => {
      if (radioButton.checked) {
        messageDiv.textContent = "";
        wrapper.classList.add('selected');
      } else {
        wrapper.classList.remove('selected');
      }
    });

    const svgIcon = document.createElement('span');
    svgIcon.appendChild(createSVGIcon(color));

    const labelText = document.createElement('span');
    labelText.textContent = `${label} (${color})`;

    wrapper.appendChild(radioButton);
    wrapper.appendChild(svgIcon);
    wrapper.appendChild(labelText);
    presetColorsContainer.appendChild(wrapper);
  });

  // カラーピッカーを生成して、selectColorsに追加
  {
    const wrapper = document.createElement('label');
    wrapper.classList.add('selectColorsItem');

    const radioButton = document.createElement('input');
    radioButton.type = 'radio';
    radioButton.name = 'presetColor';
    radioButton.value = customColor;
    radioButton.checked = (customColor === likeButtonColor) &&
                          presetColors.every(({ color }) => color !== likeButtonColor);

    const svgIcon = document.createElement('span');
    svgIcon.appendChild(createSVGIcon(customColor));

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = customColor;

    const labelText = document.createElement('span');
    labelText.textContent = `Custom (${customColor})`;

    wrapper.appendChild(radioButton);
    wrapper.appendChild(svgIcon);
    wrapper.appendChild(labelText);
    wrapper.appendChild(colorPicker);
    presetColorsContainer.appendChild(wrapper);

    // カラーピッカーが変更されたときに値を更新
    colorPicker.addEventListener('input', () => {
      const color = colorPicker.value.toUpperCase();
      chrome.storage.local.set({ customColor: color }, () => {
        console.log("customColor saved:", color);
      });
      radioButton.value = color;
      radioButton.checked = true;
      updateRadioButtonFunctionList.forEach((func) => func());
      while (svgIcon.firstChild) {
        svgIcon.firstChild.remove();
      }
      svgIcon.appendChild(createSVGIcon(color));
      labelText.textContent = `Custom (${color})`;
    });

    updateRadioButtonFunctionList.push(() => {
      if (radioButton.checked) {
        messageDiv.textContent = "";
        wrapper.classList.add('selected');
      } else {
        wrapper.classList.remove('selected');
      }
    });
  }

  // ラジオボタンの選択が変更されたときに実行する関数を登録
  document.querySelectorAll('input[name="presetColor"]').forEach((radioButton) => {
    radioButton.addEventListener('change', () => {
      updateRadioButtonFunctionList.forEach((func) => func());
    });
  });

  // ラジオボタンの初期状態を反映
  updateRadioButtonFunctionList.forEach((func) => func());

  // 保存ボタンがクリックされたときに選択した色を保存
  saveButton.addEventListener('click', () => {
    const selectedColor = document.querySelector('input[name="presetColor"]:checked').value;
    chrome.storage.local.set({ likeButtonColor: selectedColor }, () => {
      console.log("Color saved:", selectedColor);
      const message = chrome.i18n.getMessage("savedMessage");
      messageDiv.textContent = message;
    });
  });
});
