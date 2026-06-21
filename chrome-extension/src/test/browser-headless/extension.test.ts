import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { resolve } from "node:path";

const extensionDir = resolve(process.cwd(), "dist/chrome-extension");
const likeSelector = '[data-element-name="like"]';
const activeLikeSelector = '[data-playlist-state="active"] [data-element-name="like"]';
const expectedColor = "#FF8FA8";

// 直前にbuildしたdistをunpacked拡張として実Chromiumへロードする
// persistent contextを使うのは、通常のbrowser contextでは拡張をロードできないため
const launchExtension = async (): Promise<{ context: BrowserContext; page: Page }> => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
};

// watch/shortsで共通のbutton.tsを通す最小DOM
// currentとpage属性以外を共通にし、この統合テストではcontainer検出と実content scriptの結合だけに焦点を当てる
const likeButtonHtml = (current: boolean, shorts = false): string => `
  <button
    data-element-name="like"
    ${shorts ? 'data-element-page="shorts"' : ""}
    data-element-params='{"current":${String(current)}}'
  >
    <svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z" /></svg>
  </button>
`;

const watchFixture = (current: boolean): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>watch fixture</title></head><body>
  <div class="grid-area_[player]"><div class="PlayerPresenter"><div class="like-area">
    ${likeButtonHtml(current)}
  </div></div></div>
</body></html>`;

// active差し替え、like無し広告、query付きURLの正規化、watch/shortsの同一document遷移を一枚で再現する
// nicovideo.jpへrouteするため、manifest matchesとURL observerを含む実content script全体を通して検証できる
const shortsFixture = `<!doctype html>
<html><head><meta charset="utf-8"><title>shorts fixture</title></head><body></body>
<script>
  const button = (current) => \`${likeButtonHtml(false, true).replace(
    '{"current":false}',
    '{"current":${String(current)}}',
  )}\`;

  // head mutationからURL差分を検知するpage.tsにquery付きURLと正規化URLの連続変化を通知し、
  // 実サイト同様にURLイベントが複数回発火する状況を再現する
  const notifyUrlChange = (path) => {
    history.pushState({}, "", path + "?rf=nvpc&rp=shorts");
    document.head.append(document.createElement("meta"));
    queueMicrotask(() => {
      history.replaceState({}, "", path);
      document.head.append(document.createElement("meta"));
    });
  };

  window.showShorts = (id = "ss1", current = true) => {
    document.body.innerHTML = \`
      <div id="playlist">
        <div data-playlist-type="shorts" data-playlist-entry-id="\${id}" data-playlist-state="active">
          \${button(current)}
        </div>
        <div data-playlist-type="shorts" data-playlist-entry-id="ss-next" data-playlist-state="standby"></div>
        <div data-playlist-type="shorts" data-playlist-entry-id="ads-pos-0" data-playlist-state="waiting"></div>
      </div>
    \`;
  };

  // rootは置換せず、active属性とbutton DOMだけを更新する
  // ads-pos-*ではbuttonをmountせずURLも変えず、playlist observerだけで解除させる
  window.activateShort = (id, current) => {
    const root = document.querySelector("#playlist");
    for (const entry of root.querySelectorAll("[data-playlist-entry-id]")) {
      entry.setAttribute("data-playlist-state", entry.dataset.playlistEntryId === id ? "active" : "standby");
      entry.replaceChildren();
    }
    const active = root.querySelector('[data-playlist-state="active"]');
    if (!id.startsWith("ads-pos-")) active.innerHTML = button(current);
    if (!id.startsWith("ads-pos-")) notifyUrlChange("/shorts/" + id);
  };

  // リロードせずwatch DOMへ入れ替え、URLイベント経由でshorts observerを破棄して
  // watch observerへ切り替えられることを検証する
  window.showWatch = (current = true) => {
    document.body.innerHTML = \`
      <div class="grid-area_[player]"><div class="PlayerPresenter"><div class="like-area">
        \${button(current).replace(' data-element-page="shorts"', "")}
      </div></div></div>
    \`;
    notifyUrlChange("/watch/sm-fixture");
  };

  window.showShorts("ss1", true);
</script></html>`;

test("watchでいいね状態に応じてfillを同期する", async () => {
  const { context, page } = await launchExtension();
  try {
    // 実URLをローカルHTMLへ差し替え、content scriptのmatchesを満たしつつ外部状態を排除する
    // current:trueで初期表示し、拡張bootstrap直後の色付けから確認する
    await page.route("https://www.nicovideo.jp/watch/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: watchFixture(true) }),
    );
    await page.goto("https://www.nicovideo.jp/watch/sm-fixture");

    const path = page.locator(`${likeSelector} svg path`);
    await expect(path).toHaveAttribute("fill", expectedColor);

    // サイトが同じbuttonのparamsだけを更新するケース
    // 属性mutationでfillを解除する
    await page.locator(likeSelector).evaluate((button) =>
      button.setAttribute("data-element-params", '{"current":false}'),
    );
    await expect(path).not.toHaveAttribute("fill");

    // 再度current:trueへ戻し、同一button observerが継続して色を再付与できることを確認する
    await page.locator(likeSelector).evaluate((button) =>
      button.setAttribute("data-element-params", '{"current":true}'),
    );
    await expect(path).toHaveAttribute("fill", expectedColor);
  } finally {
    await context.close();
  }
});

test("shortsのactive変更・広告・watch横断へ追従する", async () => {
  const { context, page } = await launchExtension();
  try {
    // 初期active shortはcurrent:true
    // compiled extensionがactive配下だけを色付けする
    await page.route("https://www.nicovideo.jp/shorts/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: shortsFixture }),
    );
    await page.goto("https://www.nicovideo.jp/shorts/ss1");

    await expect(page.locator(`${activeLikeSelector} svg path`)).toHaveAttribute("fill", expectedColor);

    // active DOMを替えずcurrentだけfalseにし、共通button observerの色解除を確認する
    await page.locator(activeLikeSelector).evaluate((button) =>
      button.setAttribute("data-element-params", '{"current":false}'),
    );
    await expect(page.locator(`${activeLikeSelector} svg path`)).not.toHaveAttribute("fill");

    // 通常shortへの切替ではbutton DOMとURLが変わり、新しいactive buttonへ再バインドする
    await page.evaluate(() => (window as unknown as {
      activateShort: (id: string, current: boolean) => void;
    }).activateShort("ss-next", true));
    await expect(page.locator(`${activeLikeSelector} svg path`)).toHaveAttribute("fill", expectedColor);

    // 広告active中はURLを変えずlikeもmountしない
    // 古いshortのbuttonを残さないことを確認する
    await page.evaluate(() => (window as unknown as {
      activateShort: (id: string, current: boolean) => void;
    }).activateShort("ads-pos-0", false));
    await expect(page.locator(activeLikeSelector)).toHaveCount(0);

    // 広告後の通常shortで、playlist observerからbutton監視を復旧して色を付け直す
    await page.evaluate(() => (window as unknown as {
      activateShort: (id: string, current: boolean) => void;
    }).activateShort("ss1", true));
    await expect(page.locator(`${activeLikeSelector} svg path`)).toHaveAttribute("fill", expectedColor);

    // 同一documentのshorts→watch遷移でshorts監視を破棄し、watch経路へ切り替える
    await page.evaluate(() => (window as unknown as {
      showWatch: (current: boolean) => void;
    }).showWatch(true));
    await expect(page).toHaveURL("https://www.nicovideo.jp/watch/sm-fixture");
    await expect(page.locator(`${likeSelector} svg path`)).toHaveAttribute("fill", expectedColor);

    // watch -> shortsもリロードせずに戻し、
    // URLイベント後にplaylist rootとactive buttonを新しく検出できることを確認する
    await page.evaluate(() => (window as unknown as {
      showShorts: (id: string, current: boolean) => void;
    }).showShorts("ss-return", true));
    await page.evaluate(() => {
      history.pushState({}, "", "/shorts/ss-return");
      document.head.append(document.createElement("meta"));
    });
    await expect(page).toHaveURL("https://www.nicovideo.jp/shorts/ss-return");
    await expect(page.locator(`${activeLikeSelector} svg path`)).toHaveAttribute("fill", expectedColor);
  } finally {
    await context.close();
  }
});
