import { expect, test } from "@playwright/test";

test("ダミー（headless）", async () => {
  // Playwrightのheadless実行自体が失敗しないことだけを確認
  expect(true).toBe(true);
});
